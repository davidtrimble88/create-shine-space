-- Storage bucket for incident report attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-reports', 'incident-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: any authenticated staff can upload, only owner/admin can read/delete
CREATE POLICY "Staff can upload incident report files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'incident-reports');

CREATE POLICY "Owners and admins can read incident report files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'incident-reports'
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Owners and admins can delete incident report files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'incident-reports'
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- Incident reports table
CREATE TABLE public.incident_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID,
  booking_id UUID,
  -- Snapshot fields so reports stay readable even if booking/schedule changes
  student_name TEXT,
  class_date DATE,
  class_course TEXT,
  class_location_label TEXT,
  -- Structured report fields
  incident_date DATE NOT NULL,
  incident_time TEXT,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  witnesses TEXT,
  action_taken TEXT,
  -- Attachment
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_size BIGINT,
  -- Reporter + signature
  reported_by UUID,
  reporter_name TEXT NOT NULL,
  reporter_email TEXT,
  signature TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- Append-only: any authenticated staff can create
CREATE POLICY "Staff can create incident reports"
  ON public.incident_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

-- Only owner/admin can view all reports
CREATE POLICY "Owners and admins can view incident reports"
  ON public.incident_reports FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')
  );

-- No UPDATE / DELETE policies = append-only for everyone (owner/admin can still view)

CREATE INDEX idx_incident_reports_schedule_id ON public.incident_reports(schedule_id);
CREATE INDEX idx_incident_reports_booking_id ON public.incident_reports(booking_id);
CREATE INDEX idx_incident_reports_created_at ON public.incident_reports(created_at DESC);