ALTER TABLE public.instructor_assignments DROP CONSTRAINT IF EXISTS instructor_assignments_schedule_employee_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS instructor_assignments_schedule_employee_role_part_key
  ON public.instructor_assignments (schedule_id, employee_id, assignment_role, COALESCE(part, ''));