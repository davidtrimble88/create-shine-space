ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_result_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_result_check
  CHECK (result IS NULL OR result = ANY (ARRAY['pass'::text,'fail'::text,'self_drop'::text]));

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_retest_type_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_retest_type_check
  CHECK (retest_type IS NULL OR retest_type = ANY (ARRAY['skill'::text,'knowledge'::text,'both'::text,'none'::text]));