CREATE TABLE IF NOT EXISTS public.assignment_notifications_sent (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  milestone text not null,
  roles_hash text,
  created_at timestamptz not null default now(),
  unique (schedule_id, employee_id, milestone)
);
GRANT SELECT ON public.assignment_notifications_sent TO authenticated;
GRANT ALL ON public.assignment_notifications_sent TO service_role;
ALTER TABLE public.assignment_notifications_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can view assignment notices"
  ON public.assignment_notifications_sent FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));