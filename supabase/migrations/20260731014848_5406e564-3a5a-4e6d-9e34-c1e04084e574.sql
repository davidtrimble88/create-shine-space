-- Seat occupancy sync: a booking holds a seat only while it is active
CREATE OR REPLACE FUNCTION public.booking_occupies_seat(_archived boolean, _dropped boolean, _schedule_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _schedule_id IS NOT NULL
     AND COALESCE(_archived, false) = false
     AND COALESCE(_dropped, false) = false;
$$;

CREATE OR REPLACE FUNCTION public.sync_spots_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_holds boolean := false;
  new_holds boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    old_holds := public.booking_occupies_seat(OLD.archived, OLD.dropped, OLD.schedule_id);
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
    new_holds := public.booking_occupies_seat(NEW.archived, NEW.dropped, NEW.schedule_id);
  END IF;

  -- Release the old seat
  IF old_holds AND (NOT new_holds OR TG_OP = 'DELETE' OR NEW.schedule_id IS DISTINCT FROM OLD.schedule_id) THEN
    UPDATE public.schedules
      SET spots_available = spots_available + 1
      WHERE id = OLD.schedule_id;
  END IF;

  -- Take the new seat
  IF new_holds AND (NOT old_holds OR TG_OP = 'INSERT' OR NEW.schedule_id IS DISTINCT FROM OLD.schedule_id) THEN
    UPDATE public.schedules
      SET spots_available = GREATEST(spots_available - 1, 0)
      WHERE id = NEW.schedule_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_spots_on_booking ON public.bookings;
DROP TRIGGER IF EXISTS trg_sync_spots_on_booking ON public.bookings;

CREATE TRIGGER trg_sync_spots_on_booking
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_spots_on_booking();