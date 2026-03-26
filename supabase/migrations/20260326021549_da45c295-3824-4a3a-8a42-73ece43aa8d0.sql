
ALTER TABLE public.instructor_assignments 
ADD COLUMN assignment_role text NOT NULL DEFAULT 'instructor_1';
