// Daily job: any deposit whose remaining balance is still unpaid after the
// due date (7 days before class) moves the student to pending reschedule and
// releases their seat for someone else.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Business timezone day boundary (Pacific).
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { data: due, error } = await supabase
      .from("booking_deposits")
      .select("id, booking_id, balance_cents, due_date, status")
      .in("status", ["open", "awaiting_deposit"])
      .lt("due_date", today);

    if (error) return json({ error: error.message }, 500);

    const processed: string[] = [];

    for (const dep of due ?? []) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, first_name, last_name, email, location_label, schedule_date, archived")
        .eq("id", dep.booking_id)
        .maybeSingle();
      if (!booking || booking.archived) continue;

      await supabase
        .from("bookings")
        .update({
          needs_reschedule: true,
          reschedule_reason: `Deposit balance of $${(dep.balance_cents / 100).toFixed(2)} not paid by ${dep.due_date}`,
          pending_payment: true,
          pending_payment_note: `Unpaid deposit balance — seat released ${today}`,
          payment_status: "partial",
        })
        .eq("id", dep.booking_id);

      await supabase
        .from("booking_deposits")
        .update({ status: "forfeited", forfeited_at: new Date().toISOString() })
        .eq("id", dep.id);

      // Let the office know.
      const { data: owners } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["owner", "admin"]);
      for (const o of owners ?? []) {
        await supabase.rpc("notify_user", {
          _user_id: o.user_id,
          _type: "deposit_balance_missed",
          _title: "Deposit balance missed — seat released",
          _body: `${booking.first_name} ${booking.last_name} did not pay the $${(dep.balance_cents / 100).toFixed(2)} balance for ${booking.location_label} ${booking.schedule_date ?? ""}.`,
          _link: "/employee-dashboard?tab=bookings",
        });
      }

      processed.push(dep.booking_id);
    }

    return json({ success: true, processed: processed.length, date: today });
  } catch (e) {
    console.error("expire-deposit-balances error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
