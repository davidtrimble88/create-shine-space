ALTER TABLE public.instructor_assignments
  DROP CONSTRAINT IF EXISTS instructor_assignments_schedule_id_employee_id_key;

ALTER TABLE public.instructor_assignments
  ADD CONSTRAINT instructor_assignments_schedule_employee_role_key
  UNIQUE (schedule_id, employee_id, assignment_role);