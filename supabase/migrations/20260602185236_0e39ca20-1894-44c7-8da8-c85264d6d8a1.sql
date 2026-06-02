DROP POLICY IF EXISTS "Admins and owners can update employee photos" ON storage.objects;

CREATE POLICY "Admins and owners can update employee photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
)
WITH CHECK (
  bucket_id = 'employee-photos'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);