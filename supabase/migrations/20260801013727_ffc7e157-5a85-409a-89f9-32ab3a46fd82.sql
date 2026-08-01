UPDATE public.auto_email_templates
SET body = replace(body, 'https://create-shine-space.lovable.app', 'https://learntoridevc.com'),
    subject = replace(subject, 'https://create-shine-space.lovable.app', 'https://learntoridevc.com')
WHERE body ILIKE '%create-shine-space.lovable.app%' OR subject ILIKE '%create-shine-space.lovable.app%';

UPDATE public.site_content
SET content_value = replace(content_value, 'https://create-shine-space.lovable.app', 'https://learntoridevc.com')
WHERE content_value ILIKE '%create-shine-space.lovable.app%';