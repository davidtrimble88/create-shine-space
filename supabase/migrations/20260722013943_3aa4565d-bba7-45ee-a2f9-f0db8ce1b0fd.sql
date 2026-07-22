CREATE OR REPLACE VIEW public.public_instructors
WITH (security_invoker = off) AS
SELECT
  id,
  full_name,
  bio,
  photo_url,
  "position",
  show_on_website,
  is_active,
  created_at,
  photo_position_x,
  photo_position_y,
  photo_zoom
FROM public.employees
WHERE show_on_website = true
  AND is_active = true;

GRANT SELECT ON public.public_instructors TO anon;
GRANT SELECT ON public.public_instructors TO authenticated;
GRANT ALL ON public.public_instructors TO service_role;