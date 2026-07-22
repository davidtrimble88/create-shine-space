// Charges a card via Square (server-side) and creates the booking.
// Picks the correct Square account based on the booking's region.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DiscountSchema = z
  .object({
    source: z.enum(["returning", "code"]),
    code: z.string().trim().min(1).max(50).optional(),
  })
  .optional();

const BodySchema = z.object({
  sourceId: z.string().min(1),
  region: z.enum(["ventura", "high_desert"]),
  amountCents: z.number().int().positive().max(100000), // max $1000 sanity cap
  booking: z.record(z.any()),
  discount: DiscountSchema,
});

function regionCreds(region: "ventura" | "high_desert") {
  // Trim whitespace defensively — Square rejects IDs with stray spaces.
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  if (region === "ventura") {
    return {
      token: env("SQUARE_VENTURA_ACCESS_TOKEN"),
      locationId: env("SQUARE_VENTURA_LOCATION_ID"),
    };
  }
  return {
    token: env("SQUARE_HIGH_DESERT_ACCESS_TOKEN"),
    locationId: env("SQUARE_HIGH_DESERT_LOCATION_ID"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { sourceId, region, amountCents: clientAmountCents, booking, discount } = parsed.data;

    const { token, locationId } = regionCreds(region);
    if (!token || !locationId) {
      return new Response(
        JSON.stringify({ error: `Square not configured for ${region}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side price validation — never trust client-supplied amountCents.
    // Look up the booking's schedule and derive the expected charge from its
    // stored price. If a request tries to submit a lower amount, reject it.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const scheduleId = typeof booking.schedule_id === "string" ? booking.schedule_id : null;
    if (!scheduleId) {
      return new Response(
        JSON.stringify({ error: "schedule_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: sched, error: schedErr } = await supabaseAdmin
      .from("schedules")
      .select("id, price")
      .eq("id", scheduleId)
      .is("cancelled_at", null)
      .maybeSingle();

    if (schedErr || !sched) {
      return new Response(
        JSON.stringify({ error: "Schedule not found or cancelled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsePriceCents = (p: string | null | undefined): number | null => {
      if (!p) return null;
      const n = Number(String(p).replace(/[^0-9.]/g, ""));
      if (!isFinite(n) || n <= 0) return null;
      return Math.round(n * 100);
    };
    const expectedCents = parsePriceCents(sched.price as any);
    if (expectedCents == null) {
      return new Response(
        JSON.stringify({ error: "This class has no price configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server is authoritative: charge the schedule's price minus any verified discount.
    let discountCents = 0;
    let discountReason: string | null = null;
    let discountCodeStr: string | null = null;
    let discountCodeId: string | null = null;
    let discountCodeIsMultiUse = false;

    const DISCOUNT_ELIGIBLE = new Set(["intermediate", "advanced"]);

    if (discount) {
      const { data: settings } = await supabaseAdmin
        .from("discount_settings")
        .select("intermediate_returning_amount_cents, advanced_returning_amount_cents, promo_default_amount_cents")
        .eq("id", 1)
        .maybeSingle();
      const intAmount = (settings as any)?.intermediate_returning_amount_cents ?? 7500;
      const advAmount = (settings as any)?.advanced_returning_amount_cents ?? 7500;
      const promoAmount = (settings as any)?.promo_default_amount_cents ?? 5000;

      if (discount.source === "code" && discount.code) {
        const { data: dc } = await supabaseAdmin
          .from("discount_codes")
          .select("id, code, amount_cents, used_at, starts_at, expires_at, applies_to_courses, usage_type, max_uses, use_count")
          .ilike("code", discount.code)
          .maybeSingle();
        if (dc) {
          const now = new Date();
          const notStarted = dc.starts_at && new Date(dc.starts_at) > now;
          const expired = dc.expires_at && new Date(dc.expires_at) < now;
          const restrictedTo: string[] = Array.isArray(dc.applies_to_courses) ? dc.applies_to_courses : [];
          const courseOk = restrictedTo.length === 0 || restrictedTo.includes(booking.course);
          const isMulti = dc.usage_type === "multi_use";
          const usageOk = isMulti
            ? (dc.max_uses == null || (dc.use_count ?? 0) < dc.max_uses)
            : !dc.used_at;
          if (!notStarted && !expired && courseOk && usageOk) {
            discountCents = dc.amount_cents ?? (isMulti ? promoAmount : intAmount);
            discountReason = isMulti ? "promo" : "code";
            discountCodeStr = dc.code;
            discountCodeId = dc.id;
            discountCodeIsMultiUse = isMulti;
          }
        }
      } else if (discount.source === "returning" && DISCOUNT_ELIGIBLE.has(booking.course)) {
        const lic = typeof booking.license_number === "string" ? booking.license_number : null;
        const em = typeof booking.email === "string" ? booking.email : null;
        let q = supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).neq("payment_status", "cancelled");
        if (lic && em) q = q.or(`license_number.ilike.${lic},email.ilike.${em}`);
        else if (lic) q = q.ilike("license_number", lic);
        else if (em) q = q.ilike("email", em);
        else q = q.eq("id", "00000000-0000-0000-0000-000000000000");
        const { count } = await q;
        if (count && count > 0) {
          discountCents = booking.course === "advanced" ? advAmount : intAmount;
          discountReason = "returning_student";
        }
      }
    }


    const amountCents = Math.max(expectedCents - discountCents, 100);
    // Reject any client-supplied amount that doesn't match the server-derived
    // charge (allow a $1 rounding tolerance). This prevents undercharging via
    // a tampered client request. The server-computed amount is always used
    // for the actual Square charge below.
    if (Math.abs(clientAmountCents - amountCents) > 100) {
      console.warn("[square-charge] client amountCents mismatch — rejecting", {
        scheduleId,
        clientAmountCents,
        expectedCents,
        discountCents,
        amountCents,
      });
      return new Response(
        JSON.stringify({ error: "Payment amount mismatch. Please refresh and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Charge the card via Square Payments API (production)
    const idempotencyKey = crypto.randomUUID();
    const sqRes = await fetch("https://connect.squareup.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-10-17",
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        amount_money: { amount: amountCents, currency: "USD" },
        location_id: locationId,
        autocomplete: true,
        note: `${booking.course ?? "Course"} — ${booking.first_name ?? ""} ${booking.last_name ?? ""}`.trim(),
      }),
    });

    const sqData = await sqRes.json();
    if (!sqRes.ok || sqData?.errors?.length) {
      console.error("Square charge failed:", JSON.stringify(sqData));
      const msg = sqData?.errors?.[0]?.detail ?? "Payment failed";
      return new Response(JSON.stringify({ error: msg }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = sqData.payment;
    const paymentId = payment?.id;

    // Reuse the admin client from above.
    const supabase = supabaseAdmin;

    const bookingId = typeof booking.id === "string" ? booking.id : null;

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "Booking id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existing, error: existingErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", bookingId)
      .maybeSingle();

    if (existingErr) {
      console.error("Booking lookup failed after successful charge:", existingErr);
      return new Response(
        JSON.stringify({
          error: "Payment succeeded but booking verification failed. Please contact us with this reference: " + paymentId,
          paymentId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!existing) {
      const { error: insertErr } = await supabase.from("bookings").insert({
        ...booking,
        payment_status: "paid",
        booking_status: "confirmed",
        payment_provider: "square",
        discount_amount_cents: discountCents,
        discount_reason: discountReason,
        discount_code: discountCodeStr,
      });

      if (insertErr) {
        console.error("Booking insert failed after successful charge:", insertErr);
        return new Response(
          JSON.stringify({
            error: "Payment succeeded but booking could not be saved. Please contact us with this reference: " + paymentId,
            paymentId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Record discount code redemption (best effort — never fail the response here).
    if (discountCodeId) {
      try {
        if (discountCodeIsMultiUse) {
          // Fetch-then-write to increment (avoid rpc dependency).
          const { data: current } = await supabaseAdmin
            .from("discount_codes")
            .select("use_count, max_uses")
            .eq("id", discountCodeId)
            .maybeSingle();
          const nextCount = ((current as any)?.use_count ?? 0) + 1;
          if ((current as any)?.max_uses == null || nextCount <= (current as any).max_uses) {
            await supabaseAdmin
              .from("discount_codes")
              .update({ use_count: nextCount })
              .eq("id", discountCodeId);
          }
        } else {
          await supabaseAdmin
            .from("discount_codes")
            .update({
              used_at: new Date().toISOString(),
              used_by_booking_id: bookingId,
              used_by_email: typeof booking.email === "string" ? booking.email : null,
            })
            .eq("id", discountCodeId)
            .is("used_at", null);
        }
      } catch (e) {
        console.warn("Failed to record discount code usage:", e);
      }
    }


    return new Response(JSON.stringify({ success: true, paymentId, bookingId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("square-charge error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
