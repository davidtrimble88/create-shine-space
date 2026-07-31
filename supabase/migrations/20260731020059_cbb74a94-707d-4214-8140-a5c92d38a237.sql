CREATE POLICY "owner can create request for anyone"
  ON public.extra_hours_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND requested_by = auth.uid());