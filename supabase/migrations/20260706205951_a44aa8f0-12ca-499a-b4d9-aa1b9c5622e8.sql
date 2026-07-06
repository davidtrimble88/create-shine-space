
CREATE TABLE public.certification_notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cert_type TEXT NOT NULL,
  expires_on DATE NOT NULL,
  milestone TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cert_type, expires_on, milestone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certification_notifications_sent TO authenticated;
GRANT ALL ON public.certification_notifications_sent TO service_role;
ALTER TABLE public.certification_notifications_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage cert notifications" ON public.certification_notifications_sent
  FOR ALL USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
