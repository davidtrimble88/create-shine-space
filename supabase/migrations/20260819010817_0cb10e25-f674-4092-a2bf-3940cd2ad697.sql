UPDATE public.auto_email_templates
SET body = replace(
  body,
  '<a href="{{mapLink}}">View map &amp; directions</a>',
  '<a href="{{mapLink}}">View map &amp; directions</a>

<strong>Site Entrance Map:</strong>
<img src="{{siteMapImage}}" alt="Wrightwood training site map showing the entrance, classroom, and range locations" style="max-width:100%;height:auto;border:1px solid #ccc;display:block;margin-top:8px;" />'
)
WHERE id = '04668e38-ba33-4814-beb1-ec01fc330d4e';