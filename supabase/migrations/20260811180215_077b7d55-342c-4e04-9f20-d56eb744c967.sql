GRANT INSERT ON public.registration_attempts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.record_registration_payment_failure(
  p_id uuid,
  p_visitor_id text,
  p_fields jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_stage text;
BEGIN
  IF p_visitor_id IS NULL OR length(p_visitor_id) < 8 OR length(p_visitor_id) > 200 THEN
    RAISE EXCEPTION 'Invalid visitor identifier';
  END IF;

  v_status := CASE p_fields->>'status'
    WHEN 'payment_setup_failed' THEN 'payment_setup_failed'
    WHEN 'payment_failed' THEN 'payment_failed'
    WHEN 'abandoned' THEN 'abandoned'
    ELSE 'payment_failed'
  END;
  v_stage := CASE p_fields->>'stage'
    WHEN 'payment_provider' THEN 'payment_provider'
    WHEN 'payment_form' THEN 'payment_form'
    WHEN 'payment_tokenization' THEN 'payment_tokenization'
    WHEN 'payment_request' THEN 'payment_request'
    WHEN 'payment_processor' THEN 'payment_processor'
    WHEN 'payment_booking' THEN 'payment_booking'
    WHEN 'payment' THEN 'payment'
    ELSE 'payment_charge'
  END;

  IF p_id IS NOT NULL THEN
    UPDATE public.registration_attempts
    SET status = v_status,
        stage = v_stage,
        error_message = left(COALESCE(p_fields->>'error_message', 'Payment failed'), 1000),
        updated_at = now()
    WHERE id = p_id
      AND visitor_id = p_visitor_id
      AND created_at > now() - interval '24 hours'
    RETURNING id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.registration_attempts (
      status, stage, error_message, course, location_label, schedule_id,
      schedule_date, first_name, last_name, email, phone, amount_cents,
      booking_id, visitor_id
    ) VALUES (
      v_status,
      v_stage,
      left(COALESCE(p_fields->>'error_message', 'Payment failed'), 1000),
      left(p_fields->>'course', 200),
      left(p_fields->>'location_label', 200),
      CASE WHEN COALESCE(p_fields->>'schedule_id', '') ~* '^[0-9a-f-]{36}$' THEN (p_fields->>'schedule_id')::uuid ELSE NULL END,
      left(p_fields->>'schedule_date', 100),
      left(p_fields->>'first_name', 100),
      left(p_fields->>'last_name', 100),
      left(p_fields->>'email', 200),
      left(p_fields->>'phone', 50),
      CASE WHEN COALESCE(p_fields->>'amount_cents', '') ~ '^[0-9]{1,9}$' THEN (p_fields->>'amount_cents')::int ELSE NULL END,
      CASE WHEN COALESCE(p_fields->>'booking_id', '') ~* '^[0-9a-f-]{36}$' THEN (p_fields->>'booking_id')::uuid ELSE NULL END,
      p_visitor_id
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_registration_payment_failure(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_registration_payment_failure(uuid, text, jsonb) TO anon, authenticated, service_role;