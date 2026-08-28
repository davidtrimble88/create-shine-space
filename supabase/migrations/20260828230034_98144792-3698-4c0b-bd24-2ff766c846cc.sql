ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS overbook_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overbook_reason text;

CREATE OR REPLACE FUNCTION public.enforce_schedule_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  occupies boolean;
  cap integer;
  used integer;
BEGIN
  occupies := public.booking_occupies_seat(NEW.archived, NEW.dropped, NEW.schedule_id, NEW.is_retest, NEW.pending_payment);

  IF NOT occupies OR NEW.schedule_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only check when the booking is newly taking a seat on this schedule
  IF TG_OP = 'UPDATE'
     AND NEW.schedule_id IS NOT DISTINCT FROM OLD.schedule_id
     AND public.booking_occupies_seat(OLD.archived, OLD.dropped, OLD.schedule_id, OLD.is_retest, OLD.pending_payment) THEN
    RETURN NEW;
  END IF;

  IF NEW.overbook_override THEN
    IF NEW.overbook_reason IS NULL OR btrim(NEW.overbook_reason) = '' THEN
      RAISE EXCEPTION 'A reason is required when overbooking a class.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT s.total_seats INTO cap FROM public.schedules s WHERE s.id = NEW.schedule_id;

  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO used
  FROM public.bookings b
  WHERE b.schedule_id = NEW.schedule_id
    AND b.id <> NEW.id
    AND public.booking_occupies_seat(b.archived, b.dropped, b.schedule_id, b.is_retest, b.pending_payment);

  IF used >= cap THEN
    RAISE EXCEPTION 'This class is full (% of % seats taken). Use the overbook override with a reason to add anyway.', used, cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_schedule_capacity ON public.bookings;
CREATE TRIGGER trg_enforce_schedule_capacity
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_schedule_capacity();