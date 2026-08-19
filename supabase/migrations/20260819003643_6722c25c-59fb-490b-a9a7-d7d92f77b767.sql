UPDATE public.auto_email_templates
SET body = replace(body, 'https://www.learntoridevc.com/__l5e/assets-v1/', 'https://learntoridevc.com/__l5e/assets-v1/')
WHERE trigger_event = 'dl389_ready';