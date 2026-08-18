// Charges a manually-priced retest / rescheduling fee via Square.
// The amount is ALWAYS taken from the fee_payment_requests row that staff
// created — never from the client — so any amount staff sets is honored
// with no pricing rules applied.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const BodySchema = z.object({
  token: z.string().min(20).max(200),
  sourceId: z.string().min(1),
});

function regionCreds(region: "ventura" | "high_desert") {
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  if (region === "ventura") {
    return { token: env("SQUARE_VENTURA_ACCESS_TOKEN"), locationId: env("SQUARE_VENTURA_LOCATION_ID") };
  }
  return { token: env("SQUARE_HIGH_DESERT_ACCESS_TOKEN"), locationId: env("SQUARE_HIGH_DESERT_LOCATION_ID") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const { token, sourceId } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: fee } = await supabase
      .from("fee_payment_requests")
      .select("id, booking_id, fee_type, amount_cents, status, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!fee) return json({ error: "This payment link is not valid." }, 404);
    if (fee.status === "paid") return json({ error: "This fee has already been paid." }, 409);
    if (new Date(fee.expires_at) < new Date()) {
      return json({ error: "This payment link has expired. Please call the office." }, 410);
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, first_name, last_name, email, course, location, location_label, schedule_date")
      .eq("id", fee.booking_id)
      .maybeSingle();
    if (!booking) return json({ error: "We couldn't find your registration." }, 404);

    const region: "ventura" | "high_desert" =
      String(booking.location || "").startsWith("high-desert") ? "high_desert" : "ventura";
    const { token: sqToken, locationId } = regionCreds(region);
    if (!sqToken || !locationId) return json({ error: "Payments are not configured for this location." }, 500);

    // Server-authoritative amount: exactly what staff entered.
    const amountCents = fee.amount_cents;
    const feeLabel = fee.fee_type === "reschedule"
      ? "Rescheduling fee"
      : fee.fee_type === "retest"
        ? "Retest fee"
        : "Course fee";

    const sqRes = await fetch("https://connect.squareup.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sqToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-10-17",
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: crypto.randomUUID(),
        amount_money: { amount: amountCents, currency: "USD" },
        location_id: locationId,
        autocomplete: true,
        note: `${feeLabel} — ${booking.first_name ?? ""} ${booking.last_name ?? ""}`.trim(),
      }),
    });

    const sqData = await sqRes.json();
    if (!sqRes.ok || sqData?.errors?.length) {
      console.error("square-charge-fee failed:", JSON.stringify(sqData));
      const msg = sqData?.errors?.[0]?.detail ?? "Payment failed";
      return json({ error: msg, code: sqData?.errors?.[0]?.code, stage: "payment_processor" }, 402);
    }

    const payment = sqData.payment;
    const paymentId = payment?.id;

    await supabase
      .from("fee_payment_requests")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_payment_id: paymentId })
      .eq("id", fee.id);

    try {
      const card = payment?.card_details?.card ?? {};
      await supabase.from("payment_transactions").insert({
        booking_id: booking.id,
        student_email: booking.email,
        student_name: `${booking.first_name ?? ""} ${booking.last_name ?? ""}`.trim() || null,
        region,
        provider: "square",
        provider_payment_id: paymentId,
        amount_cents: amountCents,
        card_brand: card.card_brand ?? null,
        card_last4: card.last_4 ?? null,
        description: `${feeLabel} — ${booking.location_label ?? ""} ${booking.schedule_date ?? ""}`.trim(),
        status: "completed",
      });
    } catch (e) {
      console.warn("fee transaction logging failed", e);
    }

    return json({ success: true, paymentId });
  } catch (e) {
    console.error("square-charge-fee error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
