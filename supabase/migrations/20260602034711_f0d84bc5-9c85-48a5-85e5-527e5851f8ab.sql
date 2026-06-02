CREATE TABLE public.instructor_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  cmsp_expires date,
  irc_expires date,
  arc_expires date,
  cpr_expires date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_certifications TO authenticated;
GRANT ALL ON public.instructor_certifications TO service_role;

ALTER TABLE public.instructor_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own certifications"
  ON public.instructor_certifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own certifications"
  ON public.instructor_certifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own certifications"
  ON public.instructor_certifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and owners view all certifications"
  ON public.instructor_certifications FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners update all certifications"
  ON public.instructor_certifications FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_instructor_certifications_updated_at
  BEFORE UPDATE ON public.instructor_certifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();