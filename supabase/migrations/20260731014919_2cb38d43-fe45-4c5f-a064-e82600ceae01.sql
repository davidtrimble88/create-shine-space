CREATE OR REPLACE FUNCTION public.booking_occupies_seat(_archived boolean, _dropped boolean, _schedule_id uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT _schedule_id IS NOT NULL
     AND COALESCE(_archived, false) = false
     AND COALESCE(_dropped, false) = false;
$$;