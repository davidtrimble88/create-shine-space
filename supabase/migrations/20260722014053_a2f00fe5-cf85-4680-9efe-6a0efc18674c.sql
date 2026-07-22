REVOKE EXECUTE ON FUNCTION public.sync_instructor_public_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_instructor_public_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_instructor_public_profile() FROM authenticated;