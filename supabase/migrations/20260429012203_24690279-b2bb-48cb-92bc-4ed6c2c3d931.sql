-- Track cancelled schedule parts (or full cancellation)
CREATE TABLE public.schedule_cancellations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL,
  cancelled_part TEXT NOT NULL, -- 'full', 'c1', 'r1', 'c2', 'r2'
  reason TEXT,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, cancelled_part)
);

ALTER TABLE public.schedule_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cancellations"
ON public.schedule_cancellations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view cancellations"
ON public.schedule_cancellations
FOR SELECT
TO authenticated
USING (true);

-- Reschedule tracking on bookings
ALTER TABLE public.bookings
  ADD COLUMN needs_reschedule BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN reschedule_part TEXT,
  ADD COLUMN reschedule_reason TEXT,
  ADD COLUMN original_schedule_id UUID,
  ADD COLUMN original_schedule_date DATE,
  ADD COLUMN original_location_label TEXT,
  ADD COLUMN original_course TEXT,
  ADD COLUMN rescheduled_at TIMESTAMPTZ,
  ADD COLUMN rescheduled_by UUID;

CREATE INDEX idx_bookings_needs_reschedule ON public.bookings(needs_reschedule) WHERE needs_reschedule = true;