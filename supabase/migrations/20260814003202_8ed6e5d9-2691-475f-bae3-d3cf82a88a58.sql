INSERT INTO public.auto_email_templates (trigger_event, name, description, subject, body, enabled, available_variables)
VALUES (
  'cash_payment_hold',
  'Cash Payment — Registration On Hold',
  'Sent to the student (and the office) when a student chooses to pay by cash at checkout. Their seat is not reserved until payment is received.',
  'Action Required — Your Registration Is On Hold (Payment Not Received)',
  'Dear {{firstName}} {{lastName}},

This is an official notice that your registration for the {{course}} at {{locationLabel}} on {{scheduleDate}} is currently ON HOLD.

Because you selected cash payment, your seat has NOT been reserved. Seats are only held once payment is received, and availability for your chosen class date is not guaranteed. If the class fills before your payment is completed, we will help you select the next available date.

Amount due: {{fee}}

TO COMPLETE YOUR REGISTRATION
Call our office at (805) 827-0075, Monday – Friday, 9:00 AM – 5:00 PM, and we will take your payment and confirm your seat.

PREFER TO PAY BY CARD?
You can complete your payment online right now using your personal secure link:

<a href="{{payLink}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#e8590c;color:#ffffff;padding:12px 22px;border-radius:6px;font-weight:bold;text-decoration:none">Pay Now by Card</a>

If the button does not work, copy and paste this link into your browser:
{{payLink}}

This link is personal to you — please do not share it.

Class location:
{{locationAddress}}

Questions? Call (805) 827-0075 or email Office@LearnToRideVC.com

Kind regards,
Learn to Ride VC',
  true,
  ARRAY['firstName','lastName','course','locationLabel','scheduleDate','scheduleDetail','fee','payLink','locationAddress','mapLink','email']
);