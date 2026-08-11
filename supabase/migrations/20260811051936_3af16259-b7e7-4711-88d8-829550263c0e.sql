CREATE OR REPLACE FUNCTION public.is_assigned_instructor(_user_id uuid, _schedule_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.instructor_assignments ia
    JOIN public.employees e ON e.id = ia.employee_id
    WHERE ia.schedule_id = _schedule_id
      AND e.user_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.sub_requests sr
    JOIN public.employees e ON e.id = sr.covering_employee_id
    WHERE sr.schedule_id = _schedule_id
      AND sr.status = 'filled'
      AND e.user_id = _user_id
  );
$$;

CREATE POLICY "Assigned instructors can view their class bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (schedule_id IS NOT NULL AND public.is_assigned_instructor(auth.uid(), schedule_id));