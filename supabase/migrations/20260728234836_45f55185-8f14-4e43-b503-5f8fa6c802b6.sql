-- Recreate storage policies for employee-photos to resolve unexpected RLS failure on upload
DROP POLICY IF EXISTS "Admins and owners can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and owners can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and owners can delete employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view employee photos" ON storage.objects;

CREATE POLICY "Employee photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

CREATE POLICY "Employee photos staff insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'owner'::public.app_role)
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Employee photos staff update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'owner'::public.app_role)
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'owner'::public.app_role)
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Employee photos staff delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'owner'::public.app_role)
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);