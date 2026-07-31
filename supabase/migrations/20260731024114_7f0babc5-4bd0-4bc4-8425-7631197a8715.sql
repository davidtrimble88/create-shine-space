CREATE OR REPLACE FUNCTION public.is_my_employee(_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = _employee_id AND e.user_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_my_employee(uuid) TO authenticated;

CREATE TABLE public.sub_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  requester_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_by uuid,
  reason text NOT NULL,
  roles text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  covering_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  is_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sub_requests_status_check CHECK (status IN ('open','filled','cancelled'))
);

CREATE INDEX idx_sub_requests_schedule ON public.sub_requests(schedule_id);
CREATE INDEX idx_sub_requests_status ON public.sub_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_requests TO authenticated;
GRANT ALL ON public.sub_requests TO service_role;

ALTER TABLE public.sub_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view relevant sub requests"
ON public.sub_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_my_employee(requester_employee_id)
  OR (covering_employee_id IS NOT NULL AND public.is_my_employee(covering_employee_id))
);

CREATE POLICY "Instructors create own sub requests"
ON public.sub_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_my_employee(requester_employee_id)
);

CREATE POLICY "Owner admin or requester updates sub requests"
ON public.sub_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_my_employee(requester_employee_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_my_employee(requester_employee_id)
);

CREATE POLICY "Owners delete sub requests"
ON public.sub_requests FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_sub_requests_updated_at
BEFORE UPDATE ON public.sub_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.on_sub_request_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; who text; sched RECORD;
BEGIN
  SELECT full_name INTO who FROM public.employees WHERE id = NEW.requester_employee_id;
  SELECT date, location_label INTO sched FROM public.schedules WHERE id = NEW.schedule_id;
  IF NEW.status = 'open' THEN
    FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('owner'::app_role, 'admin'::app_role) LOOP
      PERFORM public.notify_user(
        r.user_id, 'sub_request_new',
        'Sub needed: ' || COALESCE(who, 'Instructor'),
        COALESCE(sched.date::text, '') || ' ' || COALESCE(sched.location_label, '') || ' — ' || NEW.reason,
        '/employee-dashboard?tab=sub-coverage'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sub_request_insert
AFTER INSERT ON public.sub_requests
FOR EACH ROW EXECUTE FUNCTION public.on_sub_request_insert();

CREATE OR REPLACE FUNCTION public.on_sub_request_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req_user uuid; cov_user uuid; cov_name text; sched RECORD;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT user_id INTO req_user FROM public.employees WHERE id = NEW.requester_employee_id;
  SELECT date, location_label INTO sched FROM public.schedules WHERE id = NEW.schedule_id;

  IF NEW.status = 'filled' THEN
    SELECT user_id, full_name INTO cov_user, cov_name FROM public.employees WHERE id = NEW.covering_employee_id;
    IF req_user IS NOT NULL THEN
      PERFORM public.notify_user(req_user, 'sub_request_filled', 'Your class is covered',
        COALESCE(cov_name, 'Another instructor') || ' is covering ' || COALESCE(sched.date::text, '') || ' ' || COALESCE(sched.location_label, ''),
        '/employee-dashboard?tab=sub-coverage');
    END IF;
    IF cov_user IS NOT NULL THEN
      PERFORM public.notify_user(cov_user, 'sub_request_assigned', 'You were assigned as a sub',
        'You are covering ' || COALESCE(sched.date::text, '') || ' ' || COALESCE(sched.location_label, ''),
        '/employee-dashboard?tab=sub-coverage');
    END IF;
  ELSIF NEW.status = 'cancelled' AND req_user IS NOT NULL THEN
    PERFORM public.notify_user(req_user, 'sub_request_cancelled', 'Sub request cancelled',
      COALESCE(sched.date::text, '') || ' ' || COALESCE(sched.location_label, ''),
      '/employee-dashboard?tab=sub-coverage');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sub_request_update
AFTER UPDATE ON public.sub_requests
FOR EACH ROW EXECUTE FUNCTION public.on_sub_request_update();