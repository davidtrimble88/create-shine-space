CREATE TABLE public.dismissed_weekends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  dismissed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date)
);

ALTER TABLE public.dismissed_weekends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dismissed weekends"
  ON public.dismissed_weekends
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can view dismissed weekends"
  ON public.dismissed_weekends
  FOR SELECT
  TO authenticated
  USING (true);