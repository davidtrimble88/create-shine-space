
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checkpoint_c1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkpoint_r1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkpoint_c2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkpoint_r2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ks_score text,
  ADD COLUMN IF NOT EXISTS ss_score text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_ks_score_len,
  DROP CONSTRAINT IF EXISTS bookings_ss_score_len;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_ks_score_len CHECK (ks_score IS NULL OR char_length(ks_score) <= 3),
  ADD CONSTRAINT bookings_ss_score_len CHECK (ss_score IS NULL OR char_length(ss_score) <= 3);
