-- Add role-based visibility for shared files
ALTER TABLE public.shared_files
  ADD COLUMN IF NOT EXISTS min_role public.app_role NOT NULL DEFAULT 'employee';

-- Hierarchy-aware visibility helper. Tiers: owner(4) > admin(3) > manager(2) > employee(1).
CREATE OR REPLACE FUNCTION public.can_view_min_role(_user_id uuid, _min public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        CASE ur.role
          WHEN 'owner' THEN 4
          WHEN 'admin' THEN 3
          WHEN 'manager' THEN 2
          ELSE 1
        END
      ) >= (
        CASE _min
          WHEN 'owner' THEN 4
          WHEN 'admin' THEN 3
          WHEN 'manager' THEN 2
          ELSE 1
        END
      )
  );
$$;

-- Replace the open-to-all select policy with a tier-aware one
DROP POLICY IF EXISTS "Authenticated can view shared files metadata" ON public.shared_files;
CREATE POLICY "Staff can view shared files within their tier"
  ON public.shared_files
  FOR SELECT
  TO authenticated
  USING (public.can_view_min_role(auth.uid(), min_role));
