// Lets a student holding a valid pay/forms token move their unpaid registration
// to another open class at the same location when their original class filled up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { token, scheduleId } = await req.json();
    if (!token || typeof token !== "string" || token.length < 20) return json({ error: "Invalid link" }, 400);
    if (!scheduleId || typeof scheduleId !== "string") return json({ error: "A class must be selected" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tok } = await supabase
      .from("booking_form_tokens")
      .select("id, booking_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!tok) return json({ error: "This link is not valid." }, 404);
    if (new Date(tok.expires_at).getTime() < Date.now()) return json({ error: "This link has expired." }, 410);

    const { data: b } = await supabase
      .from("bookings")
      .select("id, payment_status, archived, dropped, location")
      .eq("id", tok.booking_id)
      .maybeSingle();
    if (!b || b.archived || b.dropped) return json({ error: "This registration is no longer active." }, 404);
    if (b.payment_status === "paid") return json({ error: "This registration is already paid." }, 409);

    const { data: s } = await supabase
      .from("schedules")
      .select("id, date, course, location, location_label, group_name, schedule, price, spots_available, cancelled_at")
      .eq("id", scheduleId)
      .maybeSingle();
    if (!s || s.cancelled_at) return json({ error: "That class is no longer available." }, 400);
    if ((s.spots_available ?? 0) <= 0) return json({ error: "That class just filled up. Please pick another." }, 409);
    if (s.location !== b.location) return json({ error: "That class is at a different location." }, 400);

    const { error: updErr } = await supabase
      .from("bookings")
      .update({
        schedule_id: s.id,
        schedule_date: s.date,
        course: s.course,
        location: s.location,
        location_label: s.location_label,
        fee: s.price,
      })
      .eq("id", b.id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ success: true, schedule: s });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
