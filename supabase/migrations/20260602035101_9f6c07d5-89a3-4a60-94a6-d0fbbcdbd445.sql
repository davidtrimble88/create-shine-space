DROP POLICY IF EXISTS "Users insert own certifications" ON public.instructor_certifications;
DROP POLICY IF EXISTS "Users update own certifications" ON public.instructor_certifications;

CREATE POLICY "Admins and owners insert certifications"
  ON public.instructor_certifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners delete certifications"
  ON public.instructor_certifications FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));