
-- Add attachments column to auto_email_templates
ALTER TABLE public.auto_email_templates
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create public bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: owners/admins manage; public read (since bucket is public for student download links)
DO $$ BEGIN
  CREATE POLICY "Public read email attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'email-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners and admins upload email attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'email-attachments'
      AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners and admins update email attachments"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'email-attachments'
      AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners and admins delete email attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'email-attachments'
      AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
