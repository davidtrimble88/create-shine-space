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

    // Server is authoritative: charge the schedule's price, not the client's value.
    // A ±$1 tolerance mismatch on the client is logged for visibility.
    if (Math.abs(clientAmountCents - expectedCents) > 100) {
      console.warn("[square-charge] client amountCents mismatch", {
        scheduleId,
        clientAmountCents,
        expectedCents,
      });
    }
    const amountCents = expectedCents;

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
