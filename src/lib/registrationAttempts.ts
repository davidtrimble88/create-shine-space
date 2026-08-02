import { supabase } from "@/integrations/supabase/client";

export type AttemptStatus =
  | "in_progress"
  | "abandoned"
  | "payment_failed"
  | "payment_setup_failed"
  | "form_error"
  | "completed";

export interface AttemptFields {
  status?: AttemptStatus;
  stage?: string | null;
  error_message?: string | null;
  course?: string | null;
  location_label?: string | null;
  schedule_id?: string | null;
  schedule_date?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  amount_cents?: number | null;
  booking_id?: string | null;
}

const getVisitorId = () => {
  try {
    let id = localStorage.getItem("ltrvc_visitor_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("ltrvc_visitor_id", id);
    }
    return id;
  } catch {
    return null;
  }
};

/** Create a registration attempt row. Returns the attempt id (or null on failure). */
export const startAttempt = async (fields: AttemptFields): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("registration_attempts")
      .insert({ status: "in_progress", ...fields, visitor_id: getVisitorId() })
      .select("id")
      .single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (e) {
    console.warn("Failed to log registration attempt", e);
    return null;
  }
};

/** Update an existing attempt (best effort — never throws). */
export const updateAttempt = async (id: string | null, fields: AttemptFields) => {
  if (!id) return;
  const visitorId = getVisitorId();
  if (!visitorId) return;
  try {
    await supabase.rpc("update_registration_attempt", {
      p_id: id,
      p_visitor_id: visitorId,
      p_fields: fields as Record<string, unknown>,
    });
  } catch (e) {
    console.warn("Failed to update registration attempt", e);
  }
};
