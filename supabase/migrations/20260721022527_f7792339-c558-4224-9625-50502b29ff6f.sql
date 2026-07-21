
CREATE OR REPLACE VIEW public.public_instructors
WITH (security_invoker=on) AS
SELECT id, full_name, position, photo_url, bio, photo_position_x, photo_position_y, photo_zoom, created_at
FROM public.employees
WHERE show_on_website = true AND is_active = true;

GRANT SELECT ON public.public_instructors TO anon, authenticated;

-- Allow the view (running as invoker) to read the underlying rows for anon/auth without exposing the whole table
CREATE POLICY "Public can view website-approved instructors"
ON public.employees
FOR SELECT
TO anon, authenticated
USING (show_on_website = true AND is_active = true);
