CREATE OR REPLACE FUNCTION public.booking_occupies_seat(_archived boolean, _dropped boolean, _schedule_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _schedule_id IS NOT NULL
     AND COALESCE(_archived, false) = false
     AND COALESCE(_dropped, false) = false;
$$;

CREATE OR REPLACE FUNCTION public.booking_occupies_seat(_archived boolean, _dropped boolean, _schedule_id uuid, _is_retest boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _schedule_id IS NOT NULL
     AND COALESCE(_archived, false) = false
     AND COALESCE(_dropped, false) = false
     AND COALESCE(_is_retest, false) = false;
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
    old_holds := public.booking_occupies_seat(OLD.archived, OLD.dropped, OLD.schedule_id, OLD.is_retest);
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
    new_holds := public.booking_occupies_seat(NEW.archived, NEW.dropped, NEW.schedule_id, NEW.is_retest);
  END IF;

  IF old_holds AND (NOT new_holds OR TG_OP = 'DELETE' OR NEW.schedule_id IS DISTINCT FROM OLD.schedule_id) THEN
    UPDATE public.schedules
      SET spots_available = spots_available + 1
      WHERE id = OLD.schedule_id;
  END IF;

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

-- One-time correction: give back seats currently held by retest bookings
UPDATE public.schedules s
SET spots_available = s.spots_available + x.cnt
FROM (
  SELECT schedule_id, COUNT(*)::int AS cnt
  FROM public.bookings
  WHERE COALESCE(is_retest, false) = true
    AND COALESCE(archived, false) = false
    AND COALESCE(dropped, false) = false
    AND schedule_id IS NOT NULL
  GROUP BY schedule_id
) x
WHERE s.id = x.schedule_id;