-- Track instructor availability interest per class
CREATE TABLE public.instructor_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (schedule_id, user_id)
);

ALTER TABLE public.instructor_availability ENABLE ROW LEVEL SECURITY;

-- Employees can view their own availability
CREATE POLICY "Users can view their own availability"
ON public.instructor_availability FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins and managers can view all availability
CREATE POLICY "Admins and managers can view all availability"
ON public.instructor_availability FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Authenticated users can insert their own availability
CREATE POLICY "Users can insert own availability"
ON public.instructor_availability FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own availability
CREATE POLICY "Users can delete own availability"
ON public.instructor_availability FOR DELETE
TO authenticated
USING (auth.uid() = user_id);