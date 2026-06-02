GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_min_role(uuid, app_role) TO authenticated, anon, service_role;