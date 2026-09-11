CREATE TABLE public.portal_error_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_email text,
  user_name text,
  context text NOT NULL,
  route text,
  error_message text NOT NULL,
  error_details text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.portal_error_log TO anon;
GRANT INSERT, SELECT ON public.portal_error_log TO authenticated;
GRANT ALL ON public.portal_error_log TO service_role;

ALTER TABLE public.portal_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record an error"
  ON public.portal_error_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners and admins can read errors"
  ON public.portal_error_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete errors"
  ON public.portal_error_log FOR DELETE
  TO authenticated
  USING (public.is_owner(auth.uid()));

CREATE INDEX idx_portal_error_log_created_at ON public.portal_error_log (created_at DESC);