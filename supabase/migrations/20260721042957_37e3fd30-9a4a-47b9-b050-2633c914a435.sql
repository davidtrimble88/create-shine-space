
-- Tighten SELECT policies to staff-only
DROP POLICY IF EXISTS "Anyone authenticated can view dismissed weekends" ON public.dismissed_weekends;
CREATE POLICY "Staff can view dismissed weekends" ON public.dismissed_weekends
FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view assignments" ON public.instructor_assignments;
CREATE POLICY "Staff can view assignments" ON public.instructor_assignments
FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view cancellations" ON public.schedule_cancellations;
CREATE POLICY "Staff can view cancellations" ON public.schedule_cancellations
FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- Fix self-join privilege escalation on message_thread_participants
DROP POLICY IF EXISTS "Admin adds participants" ON public.message_thread_participants;
CREATE POLICY "Thread creator or admin adds participants"
ON public.message_thread_participants
FOR INSERT TO authenticated
WITH CHECK (
  public.can_start_thread(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = thread_id AND t.created_by = auth.uid()
  )
);
