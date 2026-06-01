-- Re-grant EXECUTE on has_role to authenticated; the client uses rpc('has_role') to determine UI permissions.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated;