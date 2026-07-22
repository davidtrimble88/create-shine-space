ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS manually_added boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Admins can delete manually added bookings" ON public.bookings;
CREATE POLICY "Admins can delete manually added bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND manually_added = true);