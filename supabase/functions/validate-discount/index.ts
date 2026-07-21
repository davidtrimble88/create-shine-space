// Validates a discount request for the Intermediate Course registration.
// Supports two sources:
//   - "returning": looks up prior bookings by license number or email.
//   - "code": looks up an unused, non-expired one-time discount code.
// Returns the current discount amount in cents (from discount_settings, or
// the code's override amount when present). Callable by anonymous visitors
// on the register page.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const BodySchema = z.object({
  course: z.string().trim().min(1),
  source: z.enum(["returning", "code"]),
  licenseNumber: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  code: z.string().trim().min(1).max(50).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { course, source, licenseNumber, email, code } = parsed.data;

    if (course !== "intermediate") {
      return new Response(
        JSON.stringify({ valid: false, error: "Discount only available on the Intermediate Course." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: settings } = await supabase
      .from("discount_settings")
      .select("returning_student_amount_cents")
      .eq("id", 1)
      .maybeSingle();
    const defaultAmount = settings?.returning_student_amount_cents ?? 7500;

    if (source === "code") {
      if (!code) {
        return new Response(
          JSON.stringify({ valid: false, error: "Discount code is required." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: dc } = await supabase
        .from("discount_codes")
        .select("id, code, amount_cents, used_at, expires_at")
        .ilike("code", code)
        .maybeSingle();

      if (!dc) {
        return new Response(
          JSON.stringify({ valid: false, error: "That discount code is not valid." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (dc.used_at) {
        return new Response(
          JSON.stringify({ valid: false, error: "That discount code has already been used." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (dc.expires_at && new Date(dc.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ valid: false, error: "That discount code has expired." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const amount = dc.amount_cents ?? defaultAmount;
      return new Response(
        JSON.stringify({ valid: true, source: "code", amountCents: amount, codeId: dc.id, code: dc.code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Returning-student check
    if (!licenseNumber && !email) {
      return new Response(
        JSON.stringify({ valid: false, error: "Provide an ID number or email to look up a prior class." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .neq("payment_status", "cancelled");

    if (licenseNumber && email) {
      query = query.or(`license_number.ilike.${licenseNumber},email.ilike.${email}`);
    } else if (licenseNumber) {
      query = query.ilike("license_number", licenseNumber);
    } else if (email) {
      query = query.ilike("email", email);
    }

    const { count, error: qErr } = await query;
    if (qErr) {
      console.error("validate-discount lookup error", qErr);
      return new Response(
        JSON.stringify({ valid: false, error: "Could not verify prior registration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!count || count === 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          notFound: true,
          error: "We couldn't find a past registration for that ID or email. If you believe this is a mistake, please contact the office and we'll apply the discount for you.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ valid: true, source: "returning", amountCents: defaultAmount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("validate-discount error", err);
    return new Response(
      JSON.stringify({ valid: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
