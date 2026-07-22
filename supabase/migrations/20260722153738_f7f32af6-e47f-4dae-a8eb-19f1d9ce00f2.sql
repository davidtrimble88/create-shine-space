DROP POLICY IF EXISTS "Staff can list shared files" ON storage.objects;

CREATE POLICY "Staff can list shared files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'shared-files'
  AND has_any_role(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.shared_files sf
    WHERE sf.file_path = storage.objects.name
      AND public.can_view_min_role(auth.uid(), sf.min_role)
  )
);