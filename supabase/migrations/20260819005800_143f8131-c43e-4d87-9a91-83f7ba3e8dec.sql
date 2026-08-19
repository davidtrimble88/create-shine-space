UPDATE public.auto_email_templates
SET body = replace(body, '<p style="padding:12px 14px;background:#eff6ff;border:1px solid #93c5fd;"><strong>If you are under 21:</strong> you must hold your certificate along with your permit for 6 months before you can be issued your M1 license. Keep both documents in a safe place during that period.</p>', ''),
    updated_at = now()
WHERE trigger_event = 'dl389_ready' AND match_course = '1dpc';