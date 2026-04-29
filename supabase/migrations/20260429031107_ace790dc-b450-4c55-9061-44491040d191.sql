ALTER TABLE public.schedules ADD CONSTRAINT schedules_location_check
  CHECK (location = ANY (ARRAY['high-desert-hesperia'::text, 'high-desert-wrightwood'::text, 'ventura-county'::text]));