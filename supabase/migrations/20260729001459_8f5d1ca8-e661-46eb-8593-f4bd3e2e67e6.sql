
CREATE OR REPLACE FUNCTION public.on_extra_hours_request_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; emp_name TEXT;
BEGIN
  SELECT full_name INTO emp_name FROM public.employees WHERE id = NEW.employee_id;
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'owner' LOOP
    PERFORM public.notify_user(
      r.user_id, 'extra_hours_new',
      'New extra hours request',
      COALESCE(emp_name, 'An employee') || ' requested ' || NEW.hours || ' hours',
      '/employee-dashboard?tab=work-log'
    );
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_extra_hours_request_insert ON public.extra_hours_requests;
CREATE TRIGGER trg_extra_hours_request_insert
AFTER INSERT ON public.extra_hours_requests
FOR EACH ROW EXECUTE FUNCTION public.on_extra_hours_request_insert();

CREATE OR REPLACE FUNCTION public.on_extra_hours_request_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved','denied')
     AND NEW.requested_by IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.requested_by,
      'extra_hours_' || NEW.status,
      'Extra hours request ' || NEW.status,
      'Your request for ' || OLD.hours || ' hours was ' || NEW.status ||
        CASE WHEN NEW.status = 'approved' AND NEW.hours IS DISTINCT FROM OLD.hours
             THEN ' (' || NEW.hours || ' hours approved)' ELSE '' END ||
        CASE WHEN NEW.decision_notes IS NOT NULL AND length(NEW.decision_notes) > 0
             THEN ' — ' || NEW.decision_notes ELSE '' END,
      '/employee-dashboard?tab=work-log'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_extra_hours_request_update ON public.extra_hours_requests;
CREATE TRIGGER trg_extra_hours_request_update
AFTER UPDATE ON public.extra_hours_requests
FOR EACH ROW EXECUTE FUNCTION public.on_extra_hours_request_update();
