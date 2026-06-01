ALTER TABLE public.instructor_assignments ADD COLUMN IF NOT EXISTS part text;
CREATE INDEX IF NOT EXISTS idx_instructor_assignments_schedule_part ON public.instructor_assignments(schedule_id, part);