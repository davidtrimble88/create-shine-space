-- 1. Remove bookings from Realtime publication (was broadcasting PII to all authed users)
ALTER PUBLICATION supabase_realtime DROP TABLE public.bookings;

-- 2. Lock down payment_settings; expose only active provider via SECURITY DEFINER fn
DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;
CREATE POLICY "Admins and owners can view payment settings"
  ON public.payment_settings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE OR REPLACE FUNCTION public.get_active_payment_provider()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT active_provider FROM public.payment_settings LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_active_payment_provider() FROM public;
GRANT EXECUTE ON FUNCTION public.get_active_payment_provider() TO anon, authenticated;

-- 3. Restrict employees SELECT to users with an assigned role (staff)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated can view employees" ON public.employees;
CREATE POLICY "Staff can view employees" ON public.employees
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

-- 4. id-photos: require date-prefixed UUID path to prevent arbitrary overwrites / flooding
DROP POLICY IF EXISTS "Anyone can upload id photos" ON storage.objects;
CREATE POLICY "Anyone can upload id photos to dated UUID path"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'id-photos'
    AND name ~ '^\d{4}-\d{2}-\d{2}/[a-f0-9-]{36}\.[a-z0-9]+$'
  );

-- 5. waivers bucket: only service_role uploads (edge functions). Drop anon INSERT.
DROP POLICY IF EXISTS "Service role and anon can upload waiver pdfs" ON storage.objects;

-- 6. Revoke EXECUTE on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.backfill_booking_from_waiver() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_admin_role_assignment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.decrement_spots_on_booking() FROM anon, authenticated, public;

-- 7. Pin search_path on email queue functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 8. Prevent listing of public buckets via storage.objects SELECT
DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read email attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view shared files" ON storage.objects;
CREATE POLICY "Staff can list shared files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shared-files' AND public.has_any_role(auth.uid()));

-- 9. Tighten always-true bookings INSERT with minimal sanity checks
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;
CREATE POLICY "Anyone can submit a booking"
  ON public.bookings FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(email)) > 3
    AND length(btrim(first_name)) > 0
    AND length(btrim(last_name)) > 0
    AND length(btrim(phone)) > 0
    AND length(btrim(course)) > 0
    AND length(btrim(location)) > 0
  );