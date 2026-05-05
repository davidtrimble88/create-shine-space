
INSERT INTO storage.buckets (id, name, public) VALUES ('waiver-templates', 'waiver-templates', false);

CREATE POLICY "Owners and admins can read waiver templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'waiver-templates' AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));
