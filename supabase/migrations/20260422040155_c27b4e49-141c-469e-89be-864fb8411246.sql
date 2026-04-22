ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS dl389_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS dl389_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS dl389_completed_by uuid;

CREATE INDEX IF NOT EXISTS idx_bookings_dl389_completed ON public.bookings(dl389_completed) WHERE result = 'pass';