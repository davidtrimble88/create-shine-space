
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS result text;

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_result_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_result_check
CHECK (result IS NULL OR result IN ('pass', 'fail'));
