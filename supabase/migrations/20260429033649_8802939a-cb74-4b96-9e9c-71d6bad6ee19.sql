ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS dropped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dropped_reason text,
  ADD COLUMN IF NOT EXISTS dropped_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS dropped_by uuid;

CREATE INDEX IF NOT EXISTS idx_bookings_dropped ON public.bookings(dropped) WHERE dropped = true;