-- 1) Remember each class's full seat count so availability can be recomputed.
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS total_seats integer;

UPDATE public.schedules s
SET total_seats = GREATEST(
  COALESCE(s.spots_available, 0)
  + COALESCE((
      SELECT count(*) FROM public.bookings b
      WHERE b.schedule_id = s.id
        AND public.booking_occupies_seat(b.archived, b.dropped, b.schedule_id, b.is_retest, b.pending_payment)
    ), 0)
  + COALESCE((
      SELECT count(*) FROM public.seat_holds h
      WHERE h.schedule_id = s.id AND h.released_at IS NULL AND h.expires_at > now()
    ), 0),
  0)
WHERE s.total_seats IS NULL;

-- 2) Nightly repair: recompute open seats for upcoming classes from real data.
CREATE OR REPLACE FUNCTION public.reconcile_schedule_spots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fixed integer := 0;
BEGIN
  PERFORM public.expire_seat_holds();

  WITH calc AS (
    SELECT s.id,
           GREATEST(
             COALESCE(s.total_seats, 0)
             - COALESCE((
                 SELECT count(*) FROM public.bookings b
                 WHERE b.schedule_id = s.id
                   AND public.booking_occupies_seat(b.archived, b.dropped, b.schedule_id, b.is_retest, b.pending_payment)
               ), 0)
             - COALESCE((
                 SELECT count(*) FROM public.seat_holds h
                 WHERE h.schedule_id = s.id AND h.released_at IS NULL AND h.expires_at > now()
               ), 0),
             0) AS expected
    FROM public.schedules s
    WHERE s.total_seats IS NOT NULL
      AND s.cancelled_at IS NULL
      AND s.date >= current_date - 1
  ), upd AS (
    UPDATE public.schedules s
    SET spots_available = c.expected
    FROM calc c
    WHERE s.id = c.id
      AND s.spots_available IS DISTINCT FROM c.expected
    RETURNING 1
  )
  SELECT count(*) INTO v_fixed FROM upd;

  RETURN v_fixed;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_schedule_spots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_schedule_spots() TO authenticated, service_role;

SELECT cron.schedule(
  'reconcile-schedule-spots',
  '15 9 * * *',
  $$ SELECT public.reconcile_schedule_spots(); $$
);

-- 3) Watchdog: payments taken with no confirmed/paid booking behind them.
CREATE OR REPLACE FUNCTION public.paid_unconfirmed_bookings()
RETURNS TABLE(
  transaction_id uuid,
  booking_id uuid,
  student_name text,
  student_email text,
  amount_cents integer,
  provider_payment_id text,
  paid_at timestamp with time zone,
  booking_status text,
  payment_status text,
  pending_payment boolean,
  course text,
  location_label text,
  schedule_date date
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.booking_id,
         COALESCE(t.student_name, (b.first_name || ' ' || b.last_name)),
         COALESCE(t.student_email, b.email),
         t.amount_cents, t.provider_payment_id, t.created_at,
         b.booking_status, b.payment_status, b.pending_payment,
         b.course, b.location_label, b.schedule_date
  FROM public.payment_transactions t
  LEFT JOIN public.bookings b ON b.id = t.booking_id
  WHERE t.status = 'completed'
    AND COALESCE(t.refunded_cents, 0) < t.amount_cents
    AND t.created_at > now() - interval '120 days'
    AND (
      b.id IS NULL
      OR COALESCE(b.pending_payment, false) = true
      OR b.payment_status IS DISTINCT FROM 'paid'
      OR b.booking_status IS DISTINCT FROM 'confirmed'
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  ORDER BY t.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.paid_unconfirmed_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paid_unconfirmed_bookings() TO authenticated, service_role;