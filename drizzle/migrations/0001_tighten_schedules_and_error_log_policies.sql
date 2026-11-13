-- Schedules: staff see everything; the public only sees open, upcoming classes.
DROP POLICY IF EXISTS "Anyone can view schedules" ON public.schedules;

CREATE POLICY "Staff can view all schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Public can view open upcoming schedules"
ON public.schedules
FOR SELECT
TO anon, authenticated
USING (
  cancelled_at IS NULL
  AND date >= ((now() AT TIME ZONE 'America/Los_Angeles')::date - 1)
);

-- Portal error log: callers may only log errors as themselves (or anonymously),
-- with sane size limits on every field.
DROP POLICY IF EXISTS "Anyone can record an error" ON public.portal_error_log;

CREATE POLICY "Visitors and staff can record their own errors"
ON public.portal_error_log
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND char_length(context) BETWEEN 1 AND 200
  AND char_length(error_message) BETWEEN 1 AND 2000
  AND (error_details IS NULL OR char_length(error_details) <= 20000)
  AND (route IS NULL OR char_length(route) <= 2000)
  AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
  AND (user_email IS NULL OR char_length(user_email) <= 320)
  AND (user_name IS NULL OR char_length(user_name) <= 200)
);