DROP POLICY IF EXISTS "Assigned instructors can view their class bookings" ON public.bookings;

CREATE POLICY "Staff can view bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can update roster comments"
ON public.bookings
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid()))
WITH CHECK (public.has_any_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.restrict_non_admin_booking_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
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

DROP TRIGGER IF EXISTS trg_restrict_non_admin_booking_updates ON public.bookings;
CREATE TRIGGER trg_restrict_non_admin_booking_updates
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.restrict_non_admin_booking_updates();