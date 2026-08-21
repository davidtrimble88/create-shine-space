CREATE TABLE public.seat_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  converted boolean NOT NULL DEFAULT false,
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.seat_holds TO service_role;

ALTER TABLE public.seat_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view seat holds"
ON public.seat_holds FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.seat_holds TO authenticated;

CREATE INDEX idx_seat_holds_active ON public.seat_holds (schedule_id) WHERE released_at IS NULL;
CREATE INDEX idx_seat_holds_expiry ON public.seat_holds (expires_at) WHERE released_at IS NULL;

CREATE TRIGGER seat_holds_updated_at
BEFORE UPDATE ON public.seat_holds
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Release any holds whose timer has run out, returning the seats to the class.
CREATE OR REPLACE FUNCTION public.expire_seat_holds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE h RECORD;
BEGIN
  FOR h IN
    SELECT id, schedule_id FROM public.seat_holds
    WHERE released_at IS NULL AND expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.seat_holds SET released_at = now() WHERE id = h.id;
    UPDATE public.schedules SET spots_available = spots_available + 1 WHERE id = h.schedule_id;
  END LOOP;
END;
$$;

-- Reserve a seat for a visitor for N minutes (default 30).
CREATE OR REPLACE FUNCTION public.create_seat_hold(_schedule_id uuid, _visitor_id text, _minutes integer DEFAULT 30)
RETURNS TABLE(id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_spots integer;
  v_id uuid;
  v_expires timestamptz;
  v_minutes integer := LEAST(GREATEST(COALESCE(_minutes, 30), 5), 60);
BEGIN
  IF _visitor_id IS NULL OR length(_visitor_id) < 8 OR length(_visitor_id) > 200 THEN
    RAISE EXCEPTION 'Invalid visitor identifier';
  END IF;

  PERFORM public.expire_seat_holds();

  -- One active hold per visitor at a time.
  PERFORM public.release_seat_hold(sh.id, _visitor_id, false)
  FROM public.seat_holds sh
  WHERE sh.visitor_id = _visitor_id AND sh.released_at IS NULL;

  SELECT s.spots_available INTO v_spots
  FROM public.schedules s
  WHERE s.id = _schedule_id AND s.cancelled_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLASS_UNAVAILABLE';
  END IF;

  IF v_spots <= 0 THEN
    RAISE EXCEPTION 'CLASS_FULL';
  END IF;

  v_expires := now() + make_interval(mins => v_minutes);

  INSERT INTO public.seat_holds (schedule_id, visitor_id, expires_at)
  VALUES (_schedule_id, _visitor_id, v_expires)
  RETURNING seat_holds.id INTO v_id;

  UPDATE public.schedules SET spots_available = GREATEST(spots_available - 1, 0) WHERE schedules.id = _schedule_id;

  RETURN QUERY SELECT v_id, v_expires;
END;
$$;

-- Give the seat back. Also used when a booking is created (the booking's own
-- trigger takes the seat, so the hold must always return its reserved seat).
CREATE OR REPLACE FUNCTION public.release_seat_hold(_id uuid, _visitor_id text, _converted boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE h RECORD;
BEGIN
  IF _id IS NULL OR _visitor_id IS NULL THEN RETURN; END IF;

  UPDATE public.seat_holds
  SET released_at = now(), converted = COALESCE(_converted, false)
  WHERE seat_holds.id = _id
    AND seat_holds.visitor_id = _visitor_id
    AND seat_holds.released_at IS NULL
  RETURNING seat_holds.schedule_id AS schedule_id INTO h;

  IF FOUND THEN
    UPDATE public.schedules SET spots_available = spots_available + 1 WHERE schedules.id = h.schedule_id;
  END IF;
END;
$$;

-- Check whether a hold is still alive (used by the countdown on the form).
CREATE OR REPLACE FUNCTION public.get_seat_hold(_id uuid, _visitor_id text)
RETURNS TABLE(id uuid, schedule_id uuid, expires_at timestamptz, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sh.id, sh.schedule_id, sh.expires_at,
         (sh.released_at IS NULL AND sh.expires_at > now()) AS active
  FROM public.seat_holds sh
  WHERE sh.id = _id AND sh.visitor_id = _visitor_id;
$$;