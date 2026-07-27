
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_strict(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_min_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_start_thread(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_thread_participant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_must_change_password() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_security_questions(jsonb) FROM anon;
