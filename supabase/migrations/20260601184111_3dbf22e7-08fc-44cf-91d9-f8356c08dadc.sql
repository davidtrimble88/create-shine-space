-- Tighten remaining always-true INSERT policies with minimal sanity checks
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views"
  ON public.page_views FOR INSERT TO anon, authenticated
  WITH CHECK (length(btrim(page_path)) > 0 AND length(page_path) < 2048);

DROP POLICY IF EXISTS "Anyone can create a signed waiver" ON public.signed_waivers;
CREATE POLICY "Anyone can create a signed waiver"
  ON public.signed_waivers FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(btrim(signer_email)) > 3
    AND length(btrim(signer_first_name)) > 0
    AND length(btrim(signer_last_name)) > 0
    AND length(btrim(document_hash)) > 0
  );

-- Revoke EXECUTE on remaining SECURITY DEFINER functions from clients.
-- has_role / has_any_role are used only inside RLS policies, which evaluate
-- with the policy owner's privileges and don't require caller EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM anon, authenticated, public;