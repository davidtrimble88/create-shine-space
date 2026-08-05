UPDATE public.auto_email_templates
SET body = replace(
  body,
  'Please review the entry skills test video provided during registration before class day.',
  'Please review the entry skills test video before class day:<br><a href="https://youtu.be/sTPMKDZ8Uw0?feature=shared" target="_blank" rel="noopener noreferrer">https://youtu.be/sTPMKDZ8Uw0?feature=shared</a>'
)
WHERE id = '44568722-d4c7-4f66-91cb-fbea2381813b';