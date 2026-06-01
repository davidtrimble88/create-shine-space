CREATE TABLE public.email_bcc_settings (
  id boolean PRIMARY KEY DEFAULT true,
  bcc_email text NOT NULL DEFAULT 'davidharrisontrimble@icloud.com',
  enabled boolean NOT NULL DEFAULT true,
  excluded_triggers text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT email_bcc_settings_singleton CHECK (id = true)
);

GRANT SELECT, INSERT, UPDATE ON public.email_bcc_settings TO authenticated;
GRANT ALL ON public.email_bcc_settings TO service_role;

ALTER TABLE public.email_bcc_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view bcc settings"
ON public.email_bcc_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can insert bcc settings"
ON public.email_bcc_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can update bcc settings"
ON public.email_bcc_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

INSERT INTO public.email_bcc_settings (id) VALUES (true) ON CONFLICT DO NOTHING;