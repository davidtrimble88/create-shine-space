ALTER TABLE public.schedules ADD COLUMN cancelled_at timestamp with time zone;
ALTER TABLE public.schedules ADD COLUMN cancelled_by uuid;
ALTER TABLE public.schedules ADD COLUMN cancellation_reason text;
CREATE INDEX IF NOT EXISTS idx_schedules_cancelled_at ON public.schedules(cancelled_at);