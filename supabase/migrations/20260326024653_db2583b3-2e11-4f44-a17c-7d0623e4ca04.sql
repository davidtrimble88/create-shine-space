
-- Function to decrement spots when a booking is inserted
CREATE OR REPLACE FUNCTION public.decrement_spots_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.schedule_id IS NOT NULL THEN
    UPDATE public.schedules
    SET spots_available = GREATEST(spots_available - 1, 0)
    WHERE id = NEW.schedule_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on bookings insert
CREATE TRIGGER trg_decrement_spots_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_spots_on_booking();
