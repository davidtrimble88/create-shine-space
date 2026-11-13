-- Reason supplied with each class move; consumed (and cleared) by the trigger.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS move_reason text;
COMMENT ON COLUMN public.bookings.move_reason IS 'Write-only: reason for the class move in this update. Copied to booking_class_moves.reason and cleared by trigger.';

ALTER TABLE public.booking_class_moves ADD COLUMN IF NOT EXISTS reason text;

-- Validate drops/moves, log moves with their reason, and clear the transient reason.
CREATE OR REPLACE FUNCTION public.log_booking_class_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _reason text := NULLIF(btrim(COALESCE(NEW.move_reason, '')), '');
BEGIN
  IF COALESCE(NEW.dropped, false) AND NOT COALESCE(OLD.dropped, false)
     AND NULLIF(btrim(COALESCE(NEW.dropped_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to drop a student.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.schedule_id IS NOT NULL AND NEW.schedule_id IS DISTINCT FROM OLD.schedule_id
     AND _reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required to move a student to another class.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.schedule_id IS DISTINCT FROM OLD.schedule_id THEN
    BEGIN
      INSERT INTO public.booking_class_moves (booking_id, from_schedule_id, to_schedule_id, moved_by, reason)
      VALUES (NEW.id, OLD.schedule_id, NEW.schedule_id, auth.uid(), _reason);
    EXCEPTION WHEN OTHERS THEN
      -- Never block a booking change because the history log failed
      NULL;
    END;
  END IF;

  NEW.move_reason := NULL;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_booking_class_move ON public.bookings;
CREATE TRIGGER trg_log_booking_class_move
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_class_move();