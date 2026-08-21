CREATE TABLE public.booking_deposits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  total_amount_cents integer NOT NULL CHECK (total_amount_cents > 0),
  deposit_amount_cents integer NOT NULL CHECK (deposit_amount_cents > 0),
  deposit_paid_at timestamptz,
  deposit_payment_id text,
  balance_cents integer NOT NULL CHECK (balance_cents >= 0),
  balance_paid_at timestamptz,
  balance_payment_id text,
  balance_method text,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_deposit',
  forfeited_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.booking_deposits TO authenticated;
GRANT ALL ON public.booking_deposits TO service_role;

ALTER TABLE public.booking_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view deposits"
ON public.booking_deposits FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Admins can create deposits"
ON public.booking_deposits FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update deposits"
ON public.booking_deposits FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER booking_deposits_updated_at
BEFORE UPDATE ON public.booking_deposits
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_booking_deposits_booking ON public.booking_deposits(booking_id);
CREATE INDEX idx_booking_deposits_status_due ON public.booking_deposits(status, due_date);