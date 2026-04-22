-- Create shared-files storage bucket (private, accessed via signed/auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-files', 'shared-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the shared-files bucket
CREATE POLICY "Authenticated users can view shared files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'shared-files');

CREATE POLICY "Admins and owners can upload shared files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shared-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins and owners can update shared files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shared-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins and owners can delete shared files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'shared-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Metadata table for shared files
CREATE TABLE public.shared_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view shared files metadata"
ON public.shared_files FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert shared files metadata"
ON public.shared_files FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update shared files metadata"
ON public.shared_files FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete shared files metadata"
ON public.shared_files FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_shared_files_updated_at
BEFORE UPDATE ON public.shared_files
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_shared_files_created_at ON public.shared_files(created_at DESC);