UPDATE public.auto_email_templates
SET body = REPLACE(body, 'California DMV-issued ID', 'Government-issued ID')
WHERE body ILIKE '%California DMV-issued ID%';
