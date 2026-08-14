DROP POLICY IF EXISTS "Admins and managers can view all availability" ON public.instructor_availability;
CREATE POLICY "Admins managers owners can view all availability"
ON public.instructor_availability FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Admins and managers can view all date availability" ON public.instructor_date_availability;
CREATE POLICY "Admins managers owners can view all date availability"
ON public.instructor_date_availability FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'owner'));