UPDATE public.auto_email_templates
SET body = replace(
            replace(
              replace(
                replace(body,
                  'Conduct & Safety Requirements',
                  '<mark style="background:#fff59d;padding:0 2px;">Conduct &amp; Safety Requirements</mark>'),
                'Your Class Details',
                '<mark style="background:#fff59d;padding:0 2px;">Your Class Details</mark>'),
              'Identification Requirements',
              '<mark style="background:#fff59d;padding:0 2px;">Identification Requirements</mark>'),
            'Licensing Responsibility',
            '<mark style="background:#fff59d;padding:0 2px;">Licensing Responsibility</mark>'),
    updated_at = now()
WHERE trigger_event = 'registration_confirmation'
  AND name <> 'Registration — Ventura Group B'
  AND body NOT LIKE '%<mark%';