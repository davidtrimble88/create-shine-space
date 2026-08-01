CREATE TABLE public.registration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'started',
  stage text,
  error_message text,
  course text,
  location_label text,
  schedule_id uuid,
  schedule_date text,
  first_name text,
  last_name text,
  email text,
  phone text,
  amount_cents integer,
  booking_id uuid,
  visitor_id text,
  resolved boolean NOT NULL DEFAULT false,
  staff_notes text
);

GRANT INSERT, UPDATE ON public.registration_attempts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_attempts TO authenticated;
GRANT ALL ON public.registration_attempts TO service_role;

ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a registration attempt"
  ON public.registration_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update their in-progress attempt"
  ON public.registration_attempts FOR UPDATE
  TO anon, authenticated
  USING (created_at > now() - interval '12 hours')
  WITH CHECK (true);

CREATE POLICY "Staff can view registration attempts"
  ON public.registration_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can delete registration attempts"
  ON public.registration_attempts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_registration_attempts_updated_at
  BEFORE UPDATE ON public.registration_attempts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_registration_attempts_created_at ON public.registration_attempts (created_at DESC);