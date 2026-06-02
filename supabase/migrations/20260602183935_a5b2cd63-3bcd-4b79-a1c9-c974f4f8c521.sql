DROP POLICY IF EXISTS "Admins can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee photos" ON storage.objects;

CREATE POLICY "Admins and owners can upload employee photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Admins and owners can update employee photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Admins and owners can delete employee photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);