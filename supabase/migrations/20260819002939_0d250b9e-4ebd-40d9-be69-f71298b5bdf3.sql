UPDATE public.auto_email_templates
SET body = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">
<p>Dear {{firstName}} {{lastName}},</p>
<p><strong>Congratulations on successfully completing the Motorcyclist Training Course!</strong> Your hard work, focus, and commitment to safe riding paid off, and everyone at Learn to Ride VC is proud to have had you in class.</p>
<p>Your <strong>DL389 Certificate of Completion is now complete and ready for pick up</strong> at our office:</p>
<p style="margin:16px 0;padding:14px 16px;background:#f3f4f6;border-left:4px solid #f59e0b;">
<strong>Learn to Ride VC Office</strong><br>
345 Willis Ave. #106<br>
Camarillo, CA 93010<br>
<strong>Office hours:</strong> between 9:00 AM and 5:00 PM<br>
<strong>Phone:</strong> (805) 827-0075
</p>
<p style="padding:12px 14px;background:#fff7ed;border:1px solid #fdba74;">
<strong>Please pick up your certificate by {{pickupDeadline}} at 5:00 PM.</strong> If you are not able to pick it up, your certificate will be mailed to you on Tuesday at the end of the day to the address you used when you registered online. If you wrote a different address on the paperwork you completed in person, please contact the office at (805) 827-0075 or email Office@learntoridevc.com with the correct mailing address.
</p>
<p><strong>What to do next:</strong> Once you receive your certificate, you must take it to the DMV and take their written exam to get your M1 license. Please note: your certificate is good for 1 year from the date you completed the class ({{classEndDate}}). {{under21Note}}</p>
<p>Please keep your DL389 in a safe place — replacements can take time to process.</p>
<p>If you have any questions, or if you need to confirm the mailing address we have on file, please call the office at (805) 827-0075.</p>
<p>Congratulations again, and welcome to the riding community. Ride safe!</p>
<p>— The Learn to Ride VC Team</p>
</div>',
    available_variables = ARRAY['firstName','lastName','course','locationLabel','scheduleDate','pickupDeadline','email','classEndDate','under21Note'],
    updated_at = now()
WHERE trigger_event = 'dl389_ready';