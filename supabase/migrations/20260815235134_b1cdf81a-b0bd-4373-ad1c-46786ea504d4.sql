DO $$
DECLARE
  r RECORD;
  v_marker TEXT := E'\n\n<mark style="background:#fff59d;padding:0 2px;">Arrival &amp; Rescheduling Policy</mark>\n\n';
  v_para_full TEXT := E'\n\nThis email contains important information regarding your class requirements, schedule, and conduct expectations. Please read it carefully, along with all attached documents. By attending the course, you acknowledge that you understand and agree to the policies outlined here and in the attachments.\n\n';
  v_para_irc TEXT := E'\n\nThis email contains important information regarding your class requirements, schedule, and conduct expectations. Please read it carefully. By attending the course, you acknowledge that you understand and agree to the policies outlined here.\n\n';
  v_old_suffix TEXT := E'\n\nPlease make sure you can attend every scheduled session on time.';
BEGIN
  FOR r IN SELECT id, body FROM public.auto_email_templates WHERE trigger_event = 'registration_confirmation' LOOP
    IF r.body LIKE '%along with all attached documents%' THEN
      -- Remove paragraph from its current location (after "Please make sure...")
      r.body := replace(r.body, v_old_suffix || v_para_full, v_old_suffix || E'\n\n');
      -- Insert it right before the Arrival & Rescheduling Policy marker
      r.body := replace(r.body, v_marker, v_para_full || v_marker);
    ELSIF r.body LIKE '%Please read it carefully. By attending the course%' THEN
      -- IRC template variant without attachments wording
      r.body := replace(r.body, v_old_suffix || v_para_irc, v_old_suffix || E'\n\n');
      r.body := replace(r.body, v_marker, v_para_irc || v_marker);
    END IF;

    UPDATE public.auto_email_templates SET body = r.body WHERE id = r.id;
  END LOOP;
END $$;
