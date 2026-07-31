DROP POLICY "Anyone can view active referral sources" ON public.referral_sources;

CREATE POLICY "Public can view active referral sources"
ON public.referral_sources FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Staff can view all referral sources"
ON public.referral_sources FOR SELECT
TO authenticated
USING (has_any_role(auth.uid()));