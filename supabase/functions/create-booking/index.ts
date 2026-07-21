import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const NullableString = z.string().trim().min(1).nullable().optional();

const BookingSchema = z.object({
  id: z.string().uuid(),
  schedule_id: z.string().uuid().nullable().optional(),
  course: z.string().trim().min(1),
  location: z.string().trim().min(1),
  location_label: z.string().trim().min(1),
  schedule_date: z.string().nullable().optional(),
  first_name: z.string().trim().min(1),
  middle_name: NullableString,
  last_name: z.string().trim().min(1),
  preferred_name: NullableString,
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  gender: NullableString,
  date_of_birth: z.string().nullable().optional(),
  referral_source: NullableString,
  fee: NullableString,
  address: NullableString,
  city: NullableString,
  state: NullableString,
  zip: NullableString,
  license_number: NullableString,
  issuing_country: NullableString,
  issuing_state: NullableString,
  license_expiration: z.string().nullable().optional(),
  waiver_id: z.string().uuid().nullable().optional(),
  id_photo_path: NullableString,
  guardian_id_photo_path: NullableString,
  discount_amount_cents: z.number().int().min(0).optional(),
  discount_reason: z.string().trim().min(1).nullable().optional(),
  discount_code: z.string().trim().min(1).nullable().optional(),
});

const BodySchema = z.object({
  booking: BookingSchema,
  paymentStatus: z.enum(["skipped", "unpaid"]),
  paymentProvider: z.string().trim().min(1).optional(),
  discountCodeId: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { booking, paymentStatus, paymentProvider } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: existing, error: existingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", booking.id)
      .maybeSingle();

    if (existingError) {
      console.error("create-booking existing lookup failed", existingError);
      return new Response(JSON.stringify({ error: "Could not verify existing registration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existing) {
      return new Response(JSON.stringify({ success: true, bookingId: existing.id, existing: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      ...booking,
      booking_status: "confirmed",
      payment_status: paymentStatus,
      payment_provider: paymentProvider ?? null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("bookings")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      console.error("create-booking insert failed", insertError, { bookingId: booking.id, email: booking.email });
      return new Response(JSON.stringify({ error: "Could not save booking" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, bookingId: inserted.id, existing: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-booking error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});