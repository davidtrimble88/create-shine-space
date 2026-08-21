UPDATE auto_email_templates
SET attachments = (
  SELECT COALESCE(jsonb_agg(a), '[]'::jsonb)
  FROM jsonb_array_elements(attachments::jsonb) a
  WHERE a->>'path' <> '1780284629048-8m9msw-Student_Checklist.pdf'
)
WHERE attachments::text LIKE '%1780284629048-8m9msw-Student_Checklist.pdf%';