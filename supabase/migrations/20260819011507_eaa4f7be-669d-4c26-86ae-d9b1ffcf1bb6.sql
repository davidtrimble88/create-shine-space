UPDATE public.auto_email_templates
SET body = replace(
  body,
  '<a href="{{mapLink}}">View map &amp; directions</a>',
  '<a href="{{mapLink}}">View map &amp; directions</a>' || E'\n\n' ||
  '<strong>Site Map &amp; Parking:</strong>' || E'\n' ||
  '<img src="{{siteMapImage}}" alt="Mesa School training site map showing parking, classroom, MTC range, and IRC range" style="max-width:100%;height:auto;border:1px solid #ccc;display:block;margin-top:8px;" />'
)
WHERE id IN (
  '7c7a4086-6a8a-43aa-b4c4-1e8a823a66e8',
  'c3ddd203-cd85-4e89-99d8-416ce08bc669',
  'af6bd8b8-9656-4633-a8cf-ee9f8789ac1f',
  '44568722-d4c7-4f66-91cb-fbea2381813b'
)
AND position('siteMapImage' in body) = 0;