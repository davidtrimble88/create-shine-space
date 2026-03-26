
CREATE TABLE public.instructor_date_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  location text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, location)
);

ALTER TABLE public.instructor_date_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own date availability"
  ON public.instructor_date_availability FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own date availability"
  ON public.instructor_date_availability FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own date availability"
  ON public.instructor_date_availability FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view all date availability"
  ON public.instructor_date_availability FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
