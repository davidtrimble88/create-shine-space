
CREATE TABLE public.signed_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL DEFAULT 'cmsp_waiver',
  document_version text NOT NULL,
  document_text text NOT NULL,
  document_hash text NOT NULL,
  signer_first_name text NOT NULL,
  signer_middle_name text,
  signer_last_name text NOT NULL,
  signer_email text NOT NULL,
  signer_phone text,
  date_of_birth date,
  license_number text,
  license_state text,
  is_minor boolean NOT NULL DEFAULT false,
  guardian_name text,
  guardian_relationship text,
  guardian_signature_typed text,
  guardian_signature_drawn text,
  signature_typed text NOT NULL,
  signature_drawn text NOT NULL,
  consent_acknowledgments jsonb NOT NULL DEFAULT '[]'::jsonb,
  course text,
  location text,
  location_label text,
  schedule_id uuid,
  schedule_date date,
  ip_address text,
  user_agent text,
  pdf_path text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signed_waivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a signed waiver"
ON public.signed_waivers FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Owners and admins can view signed waivers"
ON public.signed_waivers FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

ALTER TABLE public.bookings ADD COLUMN waiver_id uuid;

INSERT INTO storage.buckets (id, name, public) VALUES ('waivers', 'waivers', false);

CREATE POLICY "Owners and admins can read waiver pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'waivers' AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Service role and anon can upload waiver pdfs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'waivers');
