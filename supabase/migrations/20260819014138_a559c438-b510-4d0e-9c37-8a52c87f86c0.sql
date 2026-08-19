UPDATE public.auto_email_templates
SET body = replace(body, 'California DMV-issued ID', 'Government-issued ID'),
    subject = replace(subject, 'California DMV-issued ID', 'Government-issued ID')
WHERE trigger_event = 'registration_confirmation';