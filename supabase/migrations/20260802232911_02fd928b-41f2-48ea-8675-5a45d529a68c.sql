-- Tighten INSERT policy (no longer WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can log a registration attempt" ON public.registration_attempts;
CREATE POLICY "Anyone can log a registration attempt"
ON public.registration_attempts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'in_progress'
  AND resolved = false
  AND staff_notes IS NULL
  AND visitor_id IS NOT NULL
);

-- Remove the open UPDATE policy
DROP POLICY IF EXISTS "Anyone can update their in-progress attempt" ON public.registration_attempts;

-- Staff-only updates
CREATE POLICY "Staff can update registration attempts"
ON public.registration_attempts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Controlled visitor update path: requires the caller to prove they hold the
-- visitor_id that created the row, and only allows non-staff columns to change.
CREATE OR REPLACE FUNCTION public.update_registration_attempt(
  p_id uuid,
  p_visitor_id text,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.registration_attempts%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_visitor_id IS NULL OR length(p_visitor_id) < 8 THEN
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.registration_attempts
  WHERE id = p_id
    AND visitor_id = p_visitor_id
    AND created_at > now() - interval '12 hours';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.registration_attempts SET
    status = COALESCE(NULLIF(p_fields->>'status',''), status),
    stage = COALESCE(p_fields->>'stage', stage),
    error_message = COALESCE(left(p_fields->>'error_message', 1000), error_message),
    course = COALESCE(left(p_fields->>'course', 200), course),
    location_label = COALESCE(left(p_fields->>'location_label', 200), location_label),
    schedule_id = COALESCE(NULLIF(p_fields->>'schedule_id','')::uuid, schedule_id),
    schedule_date = COALESCE(left(p_fields->>'schedule_date', 100), schedule_date),
    first_name = COALESCE(left(p_fields->>'first_name', 100), first_name),
    last_name = COALESCE(left(p_fields->>'last_name', 100), last_name),
    email = COALESCE(left(p_fields->>'email', 200), email),
    phone = COALESCE(left(p_fields->>'phone', 50), phone),
    amount_cents = COALESCE((p_fields->>'amount_cents')::int, amount_cents),
    booking_id = COALESCE(NULLIF(p_fields->>'booking_id','')::uuid, booking_id),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_registration_attempt(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_registration_attempt(uuid, text, jsonb) TO anon, authenticated;