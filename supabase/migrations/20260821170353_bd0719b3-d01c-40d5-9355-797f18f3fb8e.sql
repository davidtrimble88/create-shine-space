REVOKE EXECUTE ON FUNCTION public.expire_seat_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_seat_holds() TO service_role;