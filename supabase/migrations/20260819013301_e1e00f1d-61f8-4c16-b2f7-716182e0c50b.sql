
DO $$
DECLARE
  vars text[] := ARRAY['firstName','lastName','course','retestType','locationLabel','locationName','locationAddress','mapLink','retestDate','arrivalTime','classEndTime','email'];
  head text := $b$Dear {{firstName}} {{lastName}},

You are confirmed for your retest with LEARN TO RIDE VC. Please read the arrival details below carefully — retests are conducted during the final riding evaluation, so your arrival time is different from a full class.

<mark style="background:#fff59d;padding:2px 6px;font-size:1.05em">🏍️ Your Retest Details</mark>

<strong>Course:</strong> {{course}}
<strong>Retest Type:</strong> {{retestType}}
<strong>Date:</strong> {{retestDate}}
<strong>Arrival Time:</strong> <u><strong>{{arrivalTime}}</strong></u> (class ends at {{classEndTime}})
<strong>Location:</strong> {{locationLabel}}
<strong>Address:</strong>
{{locationAddress}}
<a href="{{mapLink}}">View map &amp; directions</a>
$b$;
  sitemap text := $b$

<strong>Site Map &amp; Parking:</strong>
<img src="{{siteMapImage}}" alt="Training site map showing parking, classroom, and range" style="max-width:100%;height:auto;border:1px solid #ccc;display:block;margin-top:8px;" />
$b$;
  tail text := $b$

<mark style="background:#fff59d;padding:0 2px;">Arrival Policy</mark>

Please arrive at <u><strong>{{arrivalTime}}</strong></u> — no earlier and no later. If you arrive late you will <u><strong>NOT BE ADMITTED</strong></u> and will need to call our office at (805) 827-0075 to reschedule.

Do not report to the classroom. Check in with the instructor at the range and wait for direction before entering the riding area.

<mark style="background:#fff59d;padding:0 2px;">Identification Requirements</mark>

You must bring your original Driver's License, Motorcycle Permit, or California DMV-issued ID.
Photocopies or digital images cannot be accepted. This in-person verification is required by the California Highway Patrol (CHP).

<mark style="background:#fff59d;padding:0 2px;">What to Bring &amp; Wear</mark>

A motorcycle and helmet are provided. You must arrive in full riding gear as outlined in the attached Riding Gear Requirements — over-the-ankle boots, long pants, long-sleeve shirt or jacket, and full-fingered gloves. Riders without proper gear cannot participate.

Threatening, obscene, or inappropriate messages or graphics on clothing or helmets are prohibited, as is smoking or vaping anywhere on school premises.

If you have any questions, please contact us at (805) 827-0075 or email us at Office@LearnToRideVC.com

Kind regards,
Bri Austen
Office Manager
Learn to Ride VC
(805) 827-0075
www.learntoridevc.com$b$;
  reg_atts jsonb;
BEGIN
  SELECT attachments INTO reg_atts FROM public.auto_email_templates
   WHERE id = '7c7a4086-6a8a-43aa-b4c4-1e8a823a66e8';

  DELETE FROM public.auto_email_templates WHERE trigger_event = 'retest_scheduled';

  INSERT INTO public.auto_email_templates
    (trigger_event, name, description, subject, body, enabled, available_variables, attachments, match_location, match_group, match_course)
  VALUES
    ('retest_scheduled', 'Retest Scheduled — Ventura',
     'Sent when a student is scheduled for a retest at Ventura County (Somis).',
     'Your Retest Is Scheduled — {{retestDate}} at {{arrivalTime}}',
     head || sitemap || tail, true, vars, coalesce(reg_atts, '[]'::jsonb), 'ventura-county', NULL, NULL),
    ('retest_scheduled', 'Retest Scheduled — HD Wrightwood',
     'Sent when a student is scheduled for a retest at High Desert — Wrightwood.',
     'Your Retest Is Scheduled — {{retestDate}} at {{arrivalTime}}',
     head || sitemap || tail, true, vars,
     coalesce((SELECT attachments FROM public.auto_email_templates WHERE id = '04668e38-ba33-4814-beb1-ec01fc330d4e'), '[]'::jsonb),
     'high-desert-wrightwood', NULL, NULL),
    ('retest_scheduled', 'Retest Scheduled — HD Hesperia',
     'Sent when a student is scheduled for a retest at High Desert — Hesperia.',
     'Your Retest Is Scheduled — {{retestDate}} at {{arrivalTime}}',
     head || tail, true, vars,
     coalesce((SELECT attachments FROM public.auto_email_templates WHERE id = '97ef9e45-4770-4996-b99d-50d437924a0f'), '[]'::jsonb),
     'high-desert-hesperia', NULL, NULL),
    ('retest_scheduled', 'Retest Scheduled — General',
     'Fallback retest confirmation used when no location-specific template matches.',
     'Your Retest Is Scheduled — {{retestDate}} at {{arrivalTime}}',
     head || tail, true, vars, coalesce(reg_atts, '[]'::jsonb), NULL, NULL, NULL);
END $$;
