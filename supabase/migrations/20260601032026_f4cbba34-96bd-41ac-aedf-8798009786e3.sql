
DO $$
DECLARE
  v_body TEXT := 'Dear {{firstName}} {{lastName}},

Thank you for registering with LEARN TO RIDE VC for your upcoming CMSP motorcycle safety course.

This email contains important information regarding your class requirements, schedule, and conduct expectations. Please read it carefully, along with all attached documents. By attending the course, you acknowledge that you understand and agree to the policies outlined here and in the attachments.

Conduct & Safety Requirements

The California Motorcyclist Safety Program (CMSP) requires all students to maintain appropriate conduct at all times. The following are strictly prohibited during any class session:

Threatening, obscene, or inappropriate messages or graphics on clothing or helmets

Smoking or vaping anywhere on school premises

Failure to comply with CMSP or site rules may result in dismissal from the course without refund.

Your Class Details

Attached to this email, you will find:

Your class confirmation, including dates, times, and the exact location

Course requirements, including what to bring and what to wear

CMSP Student Handbook

Any additional required documents

Please review all attachments thoroughly. You are responsible for knowing your scheduled meeting times and arriving on time. Students who arrive late cannot be admitted and will be sent home per CMSP policy.

Identification Requirements

You must bring your original Driver''s License, Motorcycle Permit, or California DMV-issued ID to every session.
Photocopies or digital images cannot be accepted. This in-person verification is required by the California Highway Patrol (CHP).

Licensing Responsibility

It is your responsibility to ensure you meet all DMV licensing requirements, including:

Additional steps required for students under 21

Requirements for students who have never been licensed

Reviewing the California DMV Motorcycle Handbook

Completion of the course does not guarantee licensure; all DMV requirements must still be met.

We''re Glad You''re Here

We are excited to have you as a student and look forward to providing a safe, positive, and engaging learning experience.

If you have any questions, please contact us at (805) 827-0075 or email us at Office@LearnToRideVC.com

Thank you, and we look forward to seeing you soon.

Kind regards,
Bri Austen
Office Manager
Learn to Ride VC
(805) 827-0075
www.learntoridevc.com';
BEGIN
  INSERT INTO public.auto_email_templates (
    trigger_event, name, description, subject, body, enabled,
    available_variables, attachments, match_location, match_group, match_course
  )
  VALUES
    (
      'registration_confirmation',
      'Registration — HD Wrightwood',
      'Sent after a student registers for MTC at Wrightwood.',
      'Welcome to LEARN TO RIDE VC — Your {{course}} Registration',
      v_body,
      true,
      ARRAY['firstName','lastName','course','locationLabel','scheduleDate','schedule','fee','email','groupName'],
      '[]'::jsonb,
      'high-desert-wrightwood',
      NULL,
      'basic'
    ),
    (
      'registration_confirmation',
      'Registration — HD Hesperia',
      'Sent after a student registers for MTC at Hesperia.',
      'Welcome to LEARN TO RIDE VC — Your {{course}} Registration',
      v_body,
      true,
      ARRAY['firstName','lastName','course','locationLabel','scheduleDate','schedule','fee','email','groupName'],
      '[]'::jsonb,
      'high-desert-hesperia',
      NULL,
      'basic'
    ),
    (
      'registration_confirmation',
      'Registration — Ventura Group A',
      'Sent after a student registers for MTC at Ventura Group A.',
      'Welcome to LEARN TO RIDE VC — Your {{course}} Registration',
      v_body,
      true,
      ARRAY['firstName','lastName','course','locationLabel','scheduleDate','schedule','fee','email','groupName'],
      '[]'::jsonb,
      'ventura-county',
      'Group A',
      'basic'
    ),
    (
      'registration_confirmation',
      'Registration — Ventura Group B',
      'Sent after a student registers for MTC at Ventura Group B.',
      'Welcome to LEARN TO RIDE VC — Your {{course}} Registration',
      v_body,
      true,
      ARRAY['firstName','lastName','course','locationLabel','scheduleDate','schedule','fee','email','groupName'],
      '[]'::jsonb,
      'ventura-county',
      'Group B',
      'basic'
    );
END;
$$;
