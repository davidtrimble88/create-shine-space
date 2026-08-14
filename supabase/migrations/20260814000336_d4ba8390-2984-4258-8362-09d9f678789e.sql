ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pending_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_payment_note text,
  ADD COLUMN IF NOT EXISTS marked_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS marked_paid_by uuid;

CREATE OR REPLACE FUNCTION public.booking_occupies_seat(_archived boolean, _dropped boolean, _schedule_id uuid, _is_retest boolean, _pending_payment boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT _schedule_id IS NOT NULL
     AND COALESCE(_archived, false) = false
     AND COALESCE(_dropped, false) = false
     AND COALESCE(_is_retest, false) = false
     AND COALESCE(_pending_payment, false) = false;
$function$;

CREATE OR REPLACE FUNCTION public.sync_spots_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_holds boolean := false;
  new_holds boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    old_holds := public.booking_occupies_seat(OLD.archived, OLD.dropped, OLD.schedule_id, OLD.is_retest, OLD.pending_payment);
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
    new_holds := public.booking_occupies_seat(NEW.archived, NEW.dropped, NEW.schedule_id, NEW.is_retest, NEW.pending_payment);
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
$function$;