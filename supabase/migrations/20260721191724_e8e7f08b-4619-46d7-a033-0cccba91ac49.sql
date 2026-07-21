
DROP POLICY IF EXISTS "Public can view website-approved instructors" ON public.employees;

DROP VIEW IF EXISTS public.public_instructors;
CREATE VIEW public.public_instructors
WITH (security_invoker = on) AS
SELECT id, full_name, bio, photo_url, position, show_on_website, is_active
FROM public.employees
WHERE show_on_website = true AND is_active = true;
GRANT SELECT ON public.public_instructors TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read discount settings" ON public.discount_settings;
CREATE POLICY "Staff can read discount settings"
  ON public.discount_settings FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_returning_discount_defaults()
RETURNS TABLE(intermediate_returning_amount_cents integer, advanced_returning_amount_cents integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT intermediate_returning_amount_cents, advanced_returning_amount_cents
  FROM public.discount_settings
  WHERE id = 1
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_returning_discount_defaults() FROM public;
GRANT EXECUTE ON FUNCTION public.get_returning_discount_defaults() TO anon, authenticated, service_role;
