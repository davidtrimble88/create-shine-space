CREATE OR REPLACE FUNCTION public.restrict_non_admin_booking_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Server-side / service-role contexts (edge functions, cron jobs) have no
  -- authenticated user. They must be allowed through: RLS already gates every
  -- client-side path, and these jobs record payments and seat releases.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'owner'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-admin staff may only change roster_comment (plus the automatic updated_at).
  IF (to_jsonb(NEW) - 'roster_comment' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'roster_comment' - 'updated_at') THEN
    RAISE EXCEPTION 'Instructors may only edit roster comments';
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.bookings
SET payment_status = 'paid',
    booking_status = 'confirmed',
    payment_provider = 'square',
    pending_payment = false,
    pending_payment_note = NULL,
    marked_paid_at = COALESCE(marked_paid_at, '2026-08-26 03:08:03.559533+00')
WHERE id = '745502d0-8b5e-4802-ab0e-14a3c522a7bf';