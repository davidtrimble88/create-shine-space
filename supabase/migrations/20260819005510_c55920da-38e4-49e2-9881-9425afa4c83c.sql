insert into public.auto_email_templates
(trigger_event, name, description, subject, body, enabled, available_variables, attachments, match_course, match_location, match_group)
values (
 'dl389_ready',
 'DL389 Ready for Pickup — 1DPC',
 'Sent to 1-Day Premier Course students when their DL389 certificate is marked complete.',
 'Congratulations! Your DL389 Certificate is Ready for Pick Up',
 '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">
<p>Dear {{firstName}} {{lastName}},</p>
<p><strong>Congratulations on successfully completing the 1-Day Premier Course!</strong> Your focus, skill, and commitment to safe riding paid off, and everyone at Learn to Ride VC is proud to have had you in class.</p>
<p>Your <strong>DL389 Certificate of Completion is now complete and ready for pick up</strong> at our office:</p>
<p style="margin:16px 0;padding:14px 16px;background:#f3f4f6;border-left:4px solid #f59e0b;">
<strong>Learn to Ride VC Office</strong><br>
345 Willis Ave. #106<br>
Camarillo, CA 93010<br>
<strong>Office hours:</strong> between 9:00 AM and 5:00 PM<br>
<strong>Phone:</strong> (805) 827-0075
</p>
<p style="margin:16px 0;">
<img src="https://learntoridevc.com/__l5e/assets-v1/bf12926e-0007-447f-9d2d-47b578ec0a89/office-directions-map.jpg" alt="Map showing the route to the Learn to Ride VC office on Willis Ave in Camarillo" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:1px solid #e5e7eb;border-radius:6px;">
<span style="display:block;font-size:12px;color:#6b7280;margin-top:6px;">Our office is located off Willis Ave. Parking is available on site.</span>
</p>
<p style="padding:12px 14px;background:#fff7ed;border:1px solid #fdba74;">
<strong>Please pick up your certificate by {{pickupDeadline}} during office hours between 9:00 AM and 5:00 PM.</strong> If you are not able to pick up, your certificate will be mailed to you on Tuesday at the end of the day to the address you used when registering. If you registered under a different address, please contact the office at (805) 827-0075 or email Office@learntoridevc.com with the correct mailing address.
</p>
<p><strong>What to do next:</strong> Once you receive your certificate, you must take it to the DMV and take their written exam to get your M1 license. Please note: your certificate is good for 1 year from the date you completed the class ({{classEndDate}}).</p>
<p style="padding:12px 14px;background:#eff6ff;border:1px solid #93c5fd;"><strong>If you are under 21:</strong> you must hold your certificate along with your permit for 6 months before you can be issued your M1 license. Keep both documents in a safe place during that period.</p>
<p>Please keep your DL389 in a safe place — replacements can take time to process.</p>
<p>If you have any questions, or if you need to confirm the mailing address we have on file, please call the office at (805) 827-0075.</p>
<p style="margin:20px 0;padding:14px 16px;background:#f3f4f6;border-left:4px solid #f59e0b;"><strong>Enjoyed your class?</strong> We would love to hear about it. Reviews help other new riders find us and let us know how our instructors are doing.<br><br><a href="https://www.google.com/maps/search/?api=1&amp;query=Learn+to+Ride+VC+Camarillo" target="_blank" rel="noopener" style="display:inline-block;background:#f59e0b;color:#111111;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:6px;">Leave us a review</a></p>
<p>Congratulations again, and welcome to the riding community. Ride safe!</p>
<p>— The Learn to Ride VC Team</p>
</div>',
 true,
 array['firstName','lastName','course','locationLabel','scheduleDate','classEndDate','pickupDeadline','email']::text[],
 '[]'::jsonb,
 '1dpc', null, null
);