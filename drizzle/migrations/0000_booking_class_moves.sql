CREATE TABLE public.booking_class_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_schedule_id uuid,
  to_schedule_id uuid,
  moved_by uuid,
  moved_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.booking_class_moves TO authenticated;
GRANT ALL ON public.booking_class_moves TO service_role;

ALTER TABLE public.booking_class_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view class moves"
ON public.booking_class_moves
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX booking_class_moves_from_idx ON public.booking_class_moves(from_schedule_id);
CREATE INDEX booking_class_moves_booking_idx ON public.booking_class_moves(booking_id);

CREATE OR REPLACE FUNCTION public.log_booking_class_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.schedule_id IS DISTINCT FROM OLD.schedule_id THEN
    BEGIN
      INSERT INTO public.booking_class_moves (booking_id, from_schedule_id, to_schedule_id, moved_by)
      VALUES (NEW.id, OLD.schedule_id, NEW.schedule_id, auth.uid());
    EXCEPTION WHEN OTHERS THEN
      -- Never block a booking change because the history log failed
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_booking_class_move
AFTER UPDATE OF schedule_id ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.log_booking_class_move();