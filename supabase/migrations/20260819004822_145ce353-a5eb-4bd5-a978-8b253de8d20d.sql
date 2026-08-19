update public.auto_email_templates
set body = replace(
  replace(body,
   'your certificate is good for 1 year from the date you completed the class ({{classEndDate}}). {{under21Note}}',
   'your certificate is good for 1 year from the date you completed the class ({{classEndDate}}).</p>
<p style="padding:12px 14px;background:#eff6ff;border:1px solid #93c5fd;"><strong>If you are under 21:</strong> you must hold your certificate along with your permit for 6 months before you can be issued your M1 license. Keep both documents in a safe place during that period.'),
  '<p>— The Learn to Ride VC Team</p>',
  '<p style="margin:20px 0;padding:14px 16px;background:#f3f4f6;border-left:4px solid #f59e0b;"><strong>Enjoyed your class?</strong> We would love to hear about it. Reviews help other new riders find us and let us know how our instructors are doing.<br><br><a href="https://www.google.com/maps/search/?api=1&amp;query=Learn+to+Ride+VC+Camarillo" target="_blank" rel="noopener" style="display:inline-block;background:#f59e0b;color:#111111;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:6px;">Leave us a review</a></p>
<p>— The Learn to Ride VC Team</p>')
where trigger_event = 'dl389_ready';