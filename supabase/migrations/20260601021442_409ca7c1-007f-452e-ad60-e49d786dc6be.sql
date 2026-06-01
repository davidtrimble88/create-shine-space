CREATE OR REPLACE FUNCTION public.backfill_booking_from_waiver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
BEGIN
  IF (NEW.date_of_birth IS NULL)
     OR (NEW.license_number IS NULL OR NEW.license_number = '')
     OR (NEW.issuing_state IS NULL OR NEW.issuing_state = '')
  THEN
    SELECT date_of_birth, license_number, license_state
      INTO w
      FROM public.signed_waivers
     WHERE signer_email = NEW.email
       AND (schedule_date = NEW.schedule_date OR NEW.schedule_date IS NULL)
       AND (date_of_birth IS NOT NULL OR license_number IS NOT NULL)
     ORDER BY signed_at DESC
     LIMIT 1;

    IF FOUND THEN
      IF NEW.date_of_birth IS NULL THEN
        NEW.date_of_birth := w.date_of_birth;
      END IF;
      IF NEW.license_number IS NULL OR NEW.license_number = '' THEN
        NEW.license_number := w.license_number;
      END IF;
      IF NEW.issuing_state IS NULL OR NEW.issuing_state = '' THEN
        NEW.issuing_state := w.license_state;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_booking_from_waiver ON public.bookings;
CREATE TRIGGER trg_backfill_booking_from_waiver
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.backfill_booking_from_waiver();