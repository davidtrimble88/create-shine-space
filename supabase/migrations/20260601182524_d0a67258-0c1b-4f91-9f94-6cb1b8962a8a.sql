ALTER TABLE public.instructor_availability
ADD COLUMN IF NOT EXISTS parts text[];

-- Allow updates so users can change their partial selection
DROP POLICY IF EXISTS "Users can update own availability" ON public.instructor_availability;
CREATE POLICY "Users can update own availability"
ON public.instructor_availability
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);