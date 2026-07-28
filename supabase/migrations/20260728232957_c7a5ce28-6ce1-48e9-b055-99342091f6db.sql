CREATE TABLE public.extra_hours_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours NUMERIC(6,2) NOT NULL CHECK (hours > 0 AND hours <= 999),
  justification TEXT NOT NULL CHECK (char_length(justification) >= 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','cancelled')),
  decision_notes TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  work_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extra_hours_employee ON public.extra_hours_requests(employee_id);
CREATE INDEX idx_extra_hours_status ON public.extra_hours_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extra_hours_requests TO authenticated;
GRANT ALL ON public.extra_hours_requests TO service_role;

ALTER TABLE public.extra_hours_requests ENABLE ROW LEVEL SECURITY;

-- Requester can see their own requests (any status)
CREATE POLICY "requester can view own requests"
  ON public.extra_hours_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

-- Owner sees all
CREATE POLICY "owner views all requests"
  ON public.extra_hours_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Admin sees approved requests only
CREATE POLICY "admin views approved requests"
  ON public.extra_hours_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND status = 'approved');

-- Requester can insert for themselves; employee_id must match their own employee record
CREATE POLICY "user can create own request"
  ON public.extra_hours_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id AND e.user_id = auth.uid()
    )
  );

-- Requester can update/cancel their own pending request
CREATE POLICY "requester updates own pending"
  ON public.extra_hours_requests FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending')
  WITH CHECK (requested_by = auth.uid() AND status IN ('pending','cancelled'));

-- Owner can update any (approve/deny/edit)
CREATE POLICY "owner updates any request"
  ON public.extra_hours_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Requester can delete own pending
CREATE POLICY "requester deletes own pending"
  ON public.extra_hours_requests FOR DELETE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending');

-- Owner can delete any
CREATE POLICY "owner deletes any request"
  ON public.extra_hours_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_extra_hours_requests_updated_at
  BEFORE UPDATE ON public.extra_hours_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();