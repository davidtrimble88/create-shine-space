UPDATE auto_email_templates
SET attachments = attachments || jsonb_build_array(jsonb_build_object(
  'name','Student Checklist.pdf',
  'path','1787329380492-j8ejv1-Student_Checklist.pdf',
  'size',73572
)), updated_at = now()
WHERE trigger_event='registration_confirmation'
  AND match_course='basic'
  AND id <> '97ef9e45-4770-4996-b99d-50d437924a0f'
  AND NOT (attachments::text ILIKE '%Student_Checklist%');