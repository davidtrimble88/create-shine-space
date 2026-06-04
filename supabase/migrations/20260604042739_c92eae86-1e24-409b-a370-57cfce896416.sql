
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, read, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Helper: insert a notification for one user
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id UUID, _type TEXT, _title TEXT, _body TEXT, _link TEXT
) RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
$$;

-- ───── IT TICKETS ─────
CREATE OR REPLACE FUNCTION public.on_it_ticket_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  -- Notify all owners
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'owner' LOOP
    PERFORM public.notify_user(
      r.user_id, 'it_ticket_new',
      'New IT ticket: ' || NEW.title,
      COALESCE(NEW.submitter_name, NEW.submitter_email) || ' submitted a ticket',
      '/employee-dashboard?tab=it-tickets'
    );
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_it_ticket_insert
AFTER INSERT ON public.it_tickets
FOR EACH ROW EXECUTE FUNCTION public.on_it_ticket_insert();

CREATE OR REPLACE FUNCTION public.on_it_ticket_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; changed BOOLEAN := false;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description THEN
    changed := true;
  END IF;

  IF changed AND NEW.user_id IS NOT NULL THEN
    PERFORM public.notify_user(
      NEW.user_id, 'it_ticket_updated',
      'Your IT ticket was updated',
      NEW.title ||
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status
             THEN ' — status: ' || NEW.status ELSE '' END,
      '/employee-dashboard?tab=it-tickets'
    );
  END IF;

  -- If newly resolved, notify owners too
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'owner' LOOP
      PERFORM public.notify_user(
        r.user_id, 'it_ticket_resolved',
        'IT ticket resolved: ' || NEW.title,
        COALESCE(NEW.submitter_name, NEW.submitter_email) || '''s ticket was resolved',
        '/employee-dashboard?tab=it-tickets'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_it_ticket_update
AFTER UPDATE ON public.it_tickets
FOR EACH ROW EXECUTE FUNCTION public.on_it_ticket_update();

-- Ticket comment → notify ticket creator + owners (except commenter)
CREATE OR REPLACE FUNCTION public.on_ticket_comment_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; creator UUID; ticket_title TEXT;
BEGIN
  SELECT user_id, title INTO creator, ticket_title
  FROM public.it_tickets WHERE id = NEW.ticket_id;

  IF creator IS NOT NULL AND creator <> NEW.user_id THEN
    PERFORM public.notify_user(
      creator, 'it_ticket_comment',
      'New reply on your ticket',
      COALESCE(NEW.author_name, 'Someone') || ' commented on: ' || ticket_title,
      '/employee-dashboard?tab=it-tickets'
    );
  END IF;

  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'owner' LOOP
    IF r.user_id <> NEW.user_id AND r.user_id <> creator THEN
      PERFORM public.notify_user(
        r.user_id, 'it_ticket_comment',
        'New comment on IT ticket',
        COALESCE(NEW.author_name, 'Someone') || ' commented on: ' || ticket_title,
        '/employee-dashboard?tab=it-tickets'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ticket_comment_insert
AFTER INSERT ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.on_ticket_comment_insert();

-- ───── SCHEDULES ─────
CREATE OR REPLACE FUNCTION public.on_schedule_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles LOOP
    PERFORM public.notify_user(
      r.user_id, 'schedule_new',
      'New class scheduled',
      NEW.course || ' — ' || NEW.location_label || ' on ' || to_char(NEW.date, 'Mon DD, YYYY'),
      '/employee-dashboard?tab=full-schedule'
    );
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_schedule_insert
AFTER INSERT ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.on_schedule_insert();

-- ───── INSTRUCTOR ASSIGNMENTS ─────
CREATE OR REPLACE FUNCTION public.on_instructor_assignment_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_user UUID; s RECORD;
BEGIN
  SELECT user_id INTO emp_user FROM public.employees WHERE id = NEW.employee_id;
  IF emp_user IS NULL THEN RETURN NEW; END IF;

  SELECT course, location_label, date INTO s FROM public.schedules WHERE id = NEW.schedule_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  PERFORM public.notify_user(
    emp_user, 'assignment_new',
    'You''ve been assigned to a class',
    s.course || ' — ' || s.location_label || ' on ' || to_char(s.date, 'Mon DD, YYYY')
      || COALESCE(' (' || NEW.part || ')', ''),
    '/employee-dashboard?tab=my-schedule'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_instructor_assignment_insert
AFTER INSERT ON public.instructor_assignments
FOR EACH ROW EXECUTE FUNCTION public.on_instructor_assignment_insert();
