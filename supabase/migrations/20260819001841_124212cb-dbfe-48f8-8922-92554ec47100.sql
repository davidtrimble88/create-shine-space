INSERT INTO public.auto_email_templates
  (trigger_event, name, description, subject, body, enabled, available_variables, attachments, match_course, match_location, match_group)
VALUES (
  'dl389_ready',
  'DL389 Ready for Pickup — MTC',
  'Sent to MTC students when their DL389 certificate is marked as created in the DL389 queue.',
  'Congratulations, {{firstName}} — Your DL389 Certificate Is Ready',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">
<p>Dear {{firstName}} {{lastName}},</p>
<p><strong>Congratulations on successfully completing the Motorcyclist Training Course!</strong> Your hard work, focus, and commitment to safe riding paid off, and everyone at Learn to Ride VC is proud to have had you in class.</p>
<p>Your <strong>DL389 Certificate of Completion is now complete and ready for pick up</strong> at our office:</p>
<p style="margin:16px 0;padding:14px 16px;background:#f3f4f6;border-left:4px solid #f59e0b;">
<strong>Learn to Ride VC Office</strong><br>
345 Willis Ave. #106<br>
Camarillo, CA 93010<br>
<strong>Office hours:</strong> 9:00 AM – 5:00 PM<br>
<strong>Phone:</strong> (805) 827-0075
</p>
<p style="padding:12px 14px;background:#fff7ed;border:1px solid #fdba74;">
<strong>Please pick up your certificate by {{pickupDeadline}} at 5:00 PM.</strong> If your DL389 has not been picked up by that time, it will be mailed to the address we have on file for you.
</p>
<p><strong>What to do next:</strong> Your DL389 must be presented to the DMV as proof that you successfully completed the course. Please note that you will still be required to pass the DMV''s written exam to obtain your motorcycle endorsement.</p>
<p>Please keep your DL389 in a safe place — replacements can take time to process.</p>
<p>If you have any questions, or if you need to confirm the mailing address we have on file, please call the office at (805) 827-0075.</p>
<p>Congratulations again, and welcome to the riding community. Ride safe!</p>
<p>— The Learn to Ride VC Team</p>
</div>',
  true,
  ARRAY['firstName','lastName','course','locationLabel','scheduleDate','pickupDeadline','email'],
  '[]'::jsonb,
  'basic',
  NULL,
  NULL
);