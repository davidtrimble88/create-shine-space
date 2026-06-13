
CREATE POLICY "Owners and admins can upload waiver pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'waivers' AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "Owners and admins can upload id photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'id-photos' AND (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role)));
