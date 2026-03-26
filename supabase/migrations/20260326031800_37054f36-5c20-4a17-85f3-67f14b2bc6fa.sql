
-- Add photo and bio columns to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS show_on_website boolean NOT NULL DEFAULT false;

-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to employee-photos bucket
CREATE POLICY "Admins can upload employee photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow anyone to view employee photos (public bucket)
CREATE POLICY "Anyone can view employee photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'employee-photos');

-- Allow admins to delete employee photos
CREATE POLICY "Admins can delete employee photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to update employee photos
CREATE POLICY "Admins can update employee photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));
