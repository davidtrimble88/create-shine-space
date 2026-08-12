// Public lookup for a student's "complete your forms" link.
// Given a one-time secret token emailed by staff, returns just enough booking
// detail to prefill the CMSP forms. No auth required — the token IS the secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
      return json({ error: "Invalid link" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tok } = await supabase
      .from("booking_form_tokens")
      .select("id, booking_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!tok) return json({ error: "This link is not valid." }, 404);
    if (new Date(tok.expires_at).getTime() < Date.now()) {
      return json({ error: "This link has expired. Please contact the office." }, 410);
    }

    const { data: b } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", tok.booking_id)
      .maybeSingle();

    if (!b || b.archived || b.dropped) {
      return json({ error: "This registration is no longer active." }, 404);
    }

    await supabase
      .from("booking_form_tokens")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", tok.id);

    // Which forms are already on file for THIS booking (signed at/after it was created)?
    const since = new Date(new Date(b.created_at).getTime() - 60_000).toISOString();
    const { data: existing } = await supabase
      .from("signed_waivers")
      .select("document_type")
      .ilike("signer_email", String(b.email || ""))
      .eq("schedule_id", b.schedule_id)
      .gte("signed_at", since);

    const done = new Set((existing || []).map((r: any) => String(r.document_type)));

    return json({
      booking: {
        id: b.id,
        firstName: b.first_name,
        middleName: b.middle_name,
        lastName: b.last_name,
        email: b.email,
        phone: b.phone,
        dateOfBirth: b.date_of_birth,
        gender: b.gender,
        addressStreet: b.address,
        addressCity: b.city,
        addressState: b.state,
        addressZip: b.zip,
        licenseNumber: b.license_number,
        licenseState: b.issuing_state,
        issuingCountry: b.issuing_country,
        licenseExpiration: b.license_expiration,
        referralSource: b.referral_source,
        course: b.course,
        location: b.location,
        locationLabel: b.location_label,
        scheduleId: b.schedule_id,
        scheduleDate: b.schedule_date,
        guardianName: b.guardian_name,
        guardianRelationship: b.guardian_relationship,
        guardianEmail: b.guardian_email,
        guardianPhone: b.guardian_phone,
      },
      completed: Array.from(done),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
