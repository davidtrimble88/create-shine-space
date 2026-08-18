CREATE TABLE public.fee_payment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  fee_type text NOT NULL DEFAULT 'retest',
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  note text,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  provider_payment_id text,
  created_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.fee_payment_requests TO authenticated;
GRANT ALL ON public.fee_payment_requests TO service_role;

ALTER TABLE public.fee_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view fee payment requests"
ON public.fee_payment_requests FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Admins can create fee payment requests"
ON public.fee_payment_requests FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update fee payment requests"
ON public.fee_payment_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER fee_payment_requests_updated_at
BEFORE UPDATE ON public.fee_payment_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_fee_payment_requests_booking ON public.fee_payment_requests(booking_id);

INSERT INTO public.auto_email_templates (trigger_event, name, description, subject, body, enabled, available_variables)
VALUES (
  'fee_payment_link',
  'Retest / Reschedule Fee — Payment Link',
  'Sent by staff when a student owes a retest or rescheduling fee. The amount is set manually by staff.',
  'Payment Required — {{feeLabel}} for Learn to Ride VC',
  'Dear {{firstName}} {{lastName}},

A {{feeLabel}} of {{amount}} is due for your {{course}} registration ({{locationLabel}}{{scheduleDate}}).

{{note}}

Please use the secure link below to pay by card. Once payment is received we will confirm your new class date.

<a href="{{payLink}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#e8590c;color:#ffffff;padding:12px 22px;border-radius:6px;font-weight:bold;text-decoration:none">Pay {{amount}} Now</a>

If the button does not work, copy and paste this link into your browser:
{{payLink}}

This link is personal to you — please do not share it.

Questions? Call us at (805) 827-0075 or email Office@LearnToRideVC.com

Kind regards,
Learn to Ride VC',
  true,
  ARRAY['firstName','lastName','course','locationLabel','scheduleDate','amount','feeLabel','note','payLink','email']
);