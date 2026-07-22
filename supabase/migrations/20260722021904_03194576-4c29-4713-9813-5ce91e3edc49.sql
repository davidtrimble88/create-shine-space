
-- Fix infinite recursion in user_roles policies by using SECURITY DEFINER helpers.
DROP POLICY IF EXISTS "Owners can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage non-owner roles" ON public.user_roles;

-- Dedicated is_owner helper (does not recurse through RLS because SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'owner'::app_role
  );
$$;

-- Strict admin check (admin role only; excludes owners so we can compose policies).
CREATE OR REPLACE FUNCTION public.is_admin_strict(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::app_role
  );
$$;

CREATE POLICY "Owners can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Admins can manage non-owner roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin_strict(auth.uid()) AND role <> 'owner'::app_role)
WITH CHECK (public.is_admin_strict(auth.uid()) AND role <> 'owner'::app_role);
