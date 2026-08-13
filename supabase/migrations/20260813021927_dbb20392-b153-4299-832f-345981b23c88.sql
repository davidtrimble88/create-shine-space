update public.auto_email_templates
set body = replace(body, '<strong>Location:</strong> {{locationLabel}}', '<strong>Location:</strong> {{locationLabel}}
<strong>Address:</strong>
{{locationAddress}}
<a href="{{mapLink}}">View map &amp; directions</a>'),
updated_at = now()
where trigger_event = 'registration_confirmation'
  and body like '%<strong>Location:</strong> {{locationLabel}}%'
  and body not like '%locationAddress%';