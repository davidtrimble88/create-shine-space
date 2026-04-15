ALTER TABLE public.bookings
  ADD COLUMN address text,
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN zip text,
  ADD COLUMN license_number text,
  ADD COLUMN issuing_country text,
  ADD COLUMN issuing_state text,
  ADD COLUMN license_expiration date;