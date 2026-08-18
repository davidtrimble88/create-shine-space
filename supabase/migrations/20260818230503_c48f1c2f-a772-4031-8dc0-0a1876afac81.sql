CREATE OR REPLACE FUNCTION public.on_it_ticket_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'owner' LOOP
    PERFORM public.notify_user(
      r.user_id, 'it_ticket_new',
      'New IT ticket: ' || NEW.title,
      COALESCE(NEW.submitter_name, NEW.submitter_email) || ' submitted a ticket',
      '/employee-dashboard?tab=it-tickets&ticket=' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END; $$;

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
      '/employee-dashboard?tab=it-tickets&ticket=' || NEW.id
    );
  END IF;

  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'owner' LOOP
      PERFORM public.notify_user(
        r.user_id, 'it_ticket_resolved',
        'IT ticket resolved: ' || NEW.title,
        COALESCE(NEW.submitter_name, NEW.submitter_email) || '''s ticket was resolved',
        '/employee-dashboard?tab=it-tickets&ticket=' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END; $$;

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
      '/employee-dashboard?tab=it-tickets&ticket=' || NEW.ticket_id
    );
  END IF;

  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'owner' LOOP
    IF r.user_id <> NEW.user_id AND r.user_id <> creator THEN
      PERFORM public.notify_user(
        r.user_id, 'it_ticket_comment',
        'New comment on IT ticket',
        COALESCE(NEW.author_name, 'Someone') || ' commented on: ' || ticket_title,
        '/employee-dashboard?tab=it-tickets&ticket=' || NEW.ticket_id
      );
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.on_it_ticket_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_it_ticket_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_ticket_comment_insert() FROM PUBLIC, anon, authenticated;