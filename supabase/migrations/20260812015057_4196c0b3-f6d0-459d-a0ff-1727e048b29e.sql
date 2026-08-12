CREATE TABLE public.booking_form_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  last_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.booking_form_tokens TO authenticated;
GRANT ALL ON public.booking_form_tokens TO service_role;

ALTER TABLE public.booking_form_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view form tokens"
ON public.booking_form_tokens FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff can create form tokens"
ON public.booking_form_tokens FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(auth.uid()));

INSERT INTO public.auto_email_templates (trigger_event, name, description, subject, body, enabled, available_variables)
VALUES (
  'forms_link',
  'Forms Link — Complete Your Forms',
  'Sent by staff when a manually booked student needs to complete their CMSP forms online.',
  'Action Needed — Complete Your Forms for Learn to Ride VC',
  'Dear {{firstName}} {{lastName}},

You are registered for the {{course}} at {{locationLabel}} starting {{scheduleDate}}.

Before class day, please complete and electronically sign your required forms (CMSP Registration Form, Course Waiver, and Photo/Video Release). It only takes a few minutes.

<a href="{{formsLink}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#e8590c;color:#ffffff;padding:12px 22px;border-radius:6px;font-weight:bold;text-decoration:none">Complete My Forms</a>

If the button does not work, copy and paste this link into your browser:
{{formsLink}}

This link is personal to you — please do not share it.

If you have any questions, contact us at (805) 827-0075 or Office@LearnToRideVC.com

Kind regards,
Learn to Ride VC',
  true,
  ARRAY['firstName','lastName','course','locationLabel','scheduleDate','formsLink','email']
);