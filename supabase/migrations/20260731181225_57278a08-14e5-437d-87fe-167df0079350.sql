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
     OR (NEW.guardian_name IS NULL OR NEW.guardian_name = '')
  THEN
    SELECT date_of_birth, license_number, license_state,
           guardian_name, guardian_relationship
      INTO w
      FROM public.signed_waivers
     WHERE signer_email = NEW.email
       AND (schedule_date = NEW.schedule_date OR NEW.schedule_date IS NULL)
       AND (date_of_birth IS NOT NULL OR license_number IS NOT NULL OR guardian_name IS NOT NULL)
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
      IF (NEW.guardian_name IS NULL OR NEW.guardian_name = '') AND w.guardian_name IS NOT NULL THEN
        NEW.guardian_name := w.guardian_name;
        IF NEW.guardian_relationship IS NULL OR NEW.guardian_relationship = '' THEN
          NEW.guardian_relationship := w.guardian_relationship;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.bookings b
   SET guardian_name = COALESCE(NULLIF(b.guardian_name, ''), w.guardian_name),
       guardian_relationship = COALESCE(NULLIF(b.guardian_relationship, ''), w.guardian_relationship)
  FROM public.signed_waivers w
 WHERE w.signer_email = b.email
   AND w.guardian_name IS NOT NULL
   AND (b.guardian_name IS NULL OR b.guardian_name = '');