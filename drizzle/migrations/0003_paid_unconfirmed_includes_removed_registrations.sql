CREATE OR REPLACE FUNCTION public.paid_unconfirmed_bookings()
 RETURNS TABLE(transaction_id uuid, booking_id uuid, student_name text, student_email text, amount_cents integer, provider_payment_id text, paid_at timestamp with time zone, booking_status text, payment_status text, pending_payment boolean, course text, location_label text, schedule_date date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.booking_id,
         COALESCE(t.student_name, (b.first_name || ' ' || b.last_name)),
         COALESCE(t.student_email, b.email),
         t.amount_cents, t.provider_payment_id, t.created_at,
         CASE WHEN COALESCE(b.archived, false) THEN 'removed' ELSE b.booking_status END,
         b.payment_status, b.pending_payment,
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
      OR (
        COALESCE(b.archived, false) = true
        AND NOT EXISTS (
          SELECT 1 FROM public.bookings a
          WHERE a.id <> b.id
            AND lower(a.email) = lower(b.email)
            AND a.schedule_id IS NOT DISTINCT FROM b.schedule_id
            AND COALESCE(a.archived, false) = false
            AND COALESCE(a.dropped, false) = false
        )
      )
    )
    AND (
      public.has_role(auth.uid(), 'owner'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  ORDER BY t.created_at DESC;
$function$;