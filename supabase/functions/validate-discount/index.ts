// Validates a discount request for register-page checkout.
// Sources:
//   - "returning": prior booking by license number / email (Intermediate + Advanced only)
//   - "code": one-time code OR multi-use promotional code, with optional
//     course restrictions, start date, expiry, and max-use cap.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const RETURNING_ELIGIBLE = new Set(["intermediate", "advanced"]);

const BodySchema = z.object({
  course: z.string().trim().min(1),
  source: z.enum(["returning", "code"]),
  licenseNumber: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  code: z.string().trim().min(1).max(50).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ valid: false, error: "Invalid request" }, 400);
    const { course, source, licenseNumber, email, code } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: settings } = await supabase
      .from("discount_settings")
      .select("intermediate_returning_amount_cents, advanced_returning_amount_cents, promo_default_amount_cents")
      .eq("id", 1)
      .maybeSingle();

    const intermediateAmount = (settings as any)?.intermediate_returning_amount_cents ?? 7500;
    const advancedAmount = (settings as any)?.advanced_returning_amount_cents ?? 7500;
    const promoDefault = (settings as any)?.promo_default_amount_cents ?? 5000;

    if (source === "code") {
      if (!code) return json({ valid: false, error: "Discount code is required." });

      const { data: dc } = await supabase
        .from("discount_codes")
        .select("id, code, amount_cents, used_at, starts_at, expires_at, applies_to_courses, usage_type, max_uses, use_count")
        .ilike("code", code)
        .maybeSingle();

      if (!dc) return json({ valid: false, error: "That discount code is not valid." });

      const now = new Date();
      if (dc.starts_at && new Date(dc.starts_at) > now) {
        return json({ valid: false, error: "This discount code is not active yet." });
      }
      if (dc.expires_at && new Date(dc.expires_at) < now) {
        return json({ valid: false, error: "That discount code has expired." });
      }

      const restrictedTo: string[] = Array.isArray(dc.applies_to_courses) ? dc.applies_to_courses : [];
      if (restrictedTo.length > 0 && !restrictedTo.includes(course)) {
        return json({
          valid: false,
          error: `This code isn't valid for that course. It can be used for: ${restrictedTo.join(", ")}.`,
        });
      }

      if (dc.usage_type === "multi_use") {
        if (dc.max_uses != null && (dc.use_count ?? 0) >= dc.max_uses) {
          return json({ valid: false, error: "That discount code has reached its usage limit." });
        }
      } else {
        if (dc.used_at) return json({ valid: false, error: "That discount code has already been used." });
      }

      const amount = dc.amount_cents ?? (dc.usage_type === "multi_use" ? promoDefault : intermediateAmount);
      return json({ valid: true, source: "code", amountCents: amount, codeId: dc.id, code: dc.code });
    }

    // Returning-student check
    if (!RETURNING_ELIGIBLE.has(course)) {
      return json({
        valid: false,
        error: "Returning-student discount is only available on the Intermediate and Advanced courses.",
      });
    }

    if (!licenseNumber) {
      return json({
        valid: false,
        error: "Enter your driver's license / ID number above so we can look up your prior class.",
      });
    }

    const { count, error: qErr } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .neq("payment_status", "cancelled")
      .ilike("license_number", licenseNumber);

    if (qErr) {
      console.error("validate-discount lookup error", qErr);
      return json({ valid: false, error: "Could not verify prior registration." }, 500);
    }

    if (!count || count === 0) {
      return json({
        valid: false,
        notFound: true,
        error: "We couldn't find your ID number in our past student records. Please call the office and we'll verify your history and issue you a discount code.",
      });
    }

    const amount = course === "advanced" ? advancedAmount : intermediateAmount;
    return json({ valid: true, source: "returning", amountCents: amount });
  } catch (err) {
    console.error("validate-discount error", err);
    return json({ valid: false, error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
