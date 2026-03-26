
CREATE TABLE public.instructor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, employee_id)
);

ALTER TABLE public.instructor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage assignments"
  ON public.instructor_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated can view assignments"
  ON public.instructor_assignments FOR SELECT TO authenticated
  USING (true);
