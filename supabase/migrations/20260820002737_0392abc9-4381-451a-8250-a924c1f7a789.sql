CREATE OR REPLACE FUNCTION public.can_view_waiver(_user_id uuid, _signer_email text, _schedule_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    -- directly assigned to the waiver's own schedule
    (_schedule_id IS NOT NULL AND public.is_assigned_instructor(_user_id, _schedule_id))
    OR
    -- signer is a student on any class this user is assigned to
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE lower(b.email) = lower(COALESCE(_signer_email, ''))
        AND b.schedule_id IS NOT NULL
        AND COALESCE(b.archived, false) = false
        AND public.is_assigned_instructor(_user_id, b.schedule_id)
    );
$$;

DROP POLICY IF EXISTS "Assigned instructors can view waivers for their students" ON public.signed_waivers;
CREATE POLICY "Assigned instructors can view waivers for their students"
ON public.signed_waivers
FOR SELECT
TO authenticated
USING (public.can_view_waiver(auth.uid(), signer_email, schedule_id));