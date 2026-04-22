ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS retest_type text;

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_retest_type_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_retest_type_check
CHECK (retest_type IS NULL OR retest_type IN ('skill', 'knowledge', 'none'));

CREATE INDEX IF NOT EXISTS idx_bookings_result ON public.bookings(result);
CREATE INDEX IF NOT EXISTS idx_bookings_retest_type ON public.bookings(retest_type);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule_date ON public.bookings(schedule_date);