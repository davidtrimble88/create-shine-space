UPDATE auto_email_templates
SET body = regexp_replace(
  body,
  'Please arrive on time[^\n]*',
  '<mark style="background:#fff59d;padding:0 2px;">Arrival &amp; Rescheduling Policy</mark>' || E'\n\n' ||
  '<strong>Arrive early:</strong> You must arrive to each class session <u><strong>15 minutes early</strong></u>. If you arrive late, you will <u><strong>NOT BE ADMITTED TO CLASS</strong></u> and will be asked to leave. You will then need to call our office at (805) 827-0075 to reschedule, and a fee will apply.' || E'\n\n' ||
  '<strong>Reschedule deadline:</strong> You may reschedule your class no later than <u><strong>5 days before the class start date</strong></u>. Late reschedules and no-shows are subject to <u><strong>additional rescheduling fees</strong></u>.' || E'\n\n' ||
  'Please make sure you can attend every scheduled session on time.',
  'g'
),
updated_at = now()
WHERE body ILIKE '%Please arrive on time%';