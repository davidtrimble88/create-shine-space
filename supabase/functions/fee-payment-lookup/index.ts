// Public lookup for a manually-priced retest / rescheduling fee payment link.
// The token IS the secret — no auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string" || token.length < 20) {
      return json({ error: "This link is not valid." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: fee } = await supabase
      .from("fee_payment_requests")
      .select("id, booking_id, fee_type, amount_cents, note, status, expires_at, paid_at")
      .eq("token", token)
      .maybeSingle();

    if (!fee) return json({ error: "This payment link is not valid." }, 404);
    if (new Date(fee.expires_at) < new Date()) {
      return json({ error: "This payment link has expired. Please call the office." }, 410);
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, first_name, last_name, email, course, location, location_label, schedule_date, zip")
      .eq("id", fee.booking_id)
      .maybeSingle();

    if (!booking) return json({ error: "We couldn't find your registration." }, 404);

    return json({
      fee: {
        id: fee.id,
        feeType: fee.fee_type,
        amountCents: fee.amount_cents,
        note: fee.note,
        status: fee.status,
        paidAt: fee.paid_at,
      },
      booking: {
        id: booking.id,
        firstName: booking.first_name,
        lastName: booking.last_name,
        email: booking.email,
        course: booking.course,
        location: booking.location,
        locationLabel: booking.location_label,
        scheduleDate: booking.schedule_date,
        zip: booking.zip,
      },
    });
  } catch (e) {
    console.error("fee-payment-lookup error", e);
    return json({ error: "Something went wrong. Please call the office." }, 500);
  }
});
