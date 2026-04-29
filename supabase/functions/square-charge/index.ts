// Charges a card via Square (server-side) and creates the booking.
// Picks the correct Square account based on the booking's region.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  sourceId: z.string().min(1),
  region: z.enum(["ventura", "high_desert"]),
  amountCents: z.number().int().positive().max(100000), // max $1000 sanity cap
  booking: z.record(z.any()),
});

function regionCreds(region: "ventura" | "high_desert") {
  if (region === "ventura") {
    return {
      token: Deno.env.get("SQUARE_VENTURA_ACCESS_TOKEN"),
      locationId: Deno.env.get("SQUARE_VENTURA_LOCATION_ID"),
    };
  }
  return {
    token: Deno.env.get("SQUARE_HIGH_DESERT_ACCESS_TOKEN"),
    locationId: Deno.env.get("SQUARE_HIGH_DESERT_LOCATION_ID"),
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
    const { sourceId, region, amountCents, booking } = parsed.data;

    const { token, locationId } = regionCreds(region);
    if (!token || !locationId) {
      return new Response(
        JSON.stringify({ error: `Square not configured for ${region}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Insert the booking server-side (uses service role to bypass RLS safely)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insertErr } = await supabase.from("bookings").insert({
      ...booking,
      payment_status: "paid",
      booking_status: "confirmed",
    });

    if (insertErr) {
      console.error("Booking insert failed after successful charge:", insertErr);
      // Card was charged but booking didn't save — surface clearly
      return new Response(
        JSON.stringify({
          error: "Payment succeeded but booking could not be saved. Please contact us with this reference: " + paymentId,
          paymentId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, paymentId }), {
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
