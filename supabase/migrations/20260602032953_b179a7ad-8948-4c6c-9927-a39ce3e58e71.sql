CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.employees
  SET must_change_password = false
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;