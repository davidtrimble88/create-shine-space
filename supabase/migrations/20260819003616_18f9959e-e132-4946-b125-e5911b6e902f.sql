UPDATE public.auto_email_templates
SET body = replace(
  body,
  '<strong>Phone:</strong> (805) 827-0075
</p>',
  '<strong>Phone:</strong> (805) 827-0075
</p>
<p style="margin:16px 0;">
<img src="https://www.learntoridevc.com/__l5e/assets-v1/bf12926e-0007-447f-9d2d-47b578ec0a89/office-directions-map.jpg" alt="Map showing the route to the Learn to Ride VC office on Willis Ave in Camarillo" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:1px solid #e5e7eb;border-radius:6px;">
<span style="display:block;font-size:12px;color:#6b7280;margin-top:6px;">Our office is located off Willis Ave. Parking is available on site.</span>
</p>'
)
WHERE trigger_event = 'dl389_ready';