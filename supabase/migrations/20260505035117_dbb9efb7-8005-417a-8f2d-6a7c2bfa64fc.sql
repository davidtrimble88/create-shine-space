-- Create private bucket for ID photos uploaded during registration
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-photos', 'id-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone (including anon) can upload an ID photo as part of registration
CREATE POLICY "Anyone can upload id photos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'id-photos');

-- Only owners and admins can view ID photos
CREATE POLICY "Owners and admins can view id photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-photos' AND (
    has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Track ID photo paths on bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS id_photo_path text,
  ADD COLUMN IF NOT EXISTS guardian_id_photo_path text;