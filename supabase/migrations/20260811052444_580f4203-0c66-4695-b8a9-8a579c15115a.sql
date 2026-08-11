DROP TRIGGER IF EXISTS trg_restrict_non_admin_booking_updates ON public.bookings;
CREATE TRIGGER aaa_restrict_non_admin_booking_updates
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.restrict_non_admin_booking_updates();