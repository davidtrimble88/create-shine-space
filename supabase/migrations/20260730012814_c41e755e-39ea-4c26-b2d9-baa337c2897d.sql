create or replace function public.employee_login_stats()
returns table (user_id uuid, login_count bigint, last_login_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.user_id, count(*)::bigint, max(l.created_at)
  from public.employee_logins l
  where public.has_role(auth.uid(), 'owner'::app_role)
     or public.has_role(auth.uid(), 'admin'::app_role)
     or l.user_id = auth.uid()
  group by l.user_id
$$;

grant execute on function public.employee_login_stats() to authenticated;