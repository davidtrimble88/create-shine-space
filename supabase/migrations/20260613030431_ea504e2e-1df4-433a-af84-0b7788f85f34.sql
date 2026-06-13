UPDATE public.auto_email_templates
SET body = regexp_replace(
  body,
  E'(Thank you for registering with LEARN TO RIDE VC for your upcoming CMSP motorcycle safety course\\.)',
  E'\\1\n\n<mark style="background:#fff59d;padding:2px 6px;font-size:1.05em">📅 Your Class Schedule</mark>\n\n<strong>Course:</strong> {{course}}\n<strong>Location:</strong> {{locationLabel}}\n<strong>Start Date:</strong> {{scheduleDate}}\n<strong>Class Days &amp; Times:</strong>\n{{scheduleDetail}}\n\nPlease arrive on time for every session — late arrivals cannot be admitted.',
  'g'
)
WHERE trigger_event = 'registration_confirmation'
  AND body NOT LIKE '%Your Class Schedule%';