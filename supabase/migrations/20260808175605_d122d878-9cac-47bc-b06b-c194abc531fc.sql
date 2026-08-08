CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid,
  student_email text,
  student_name text,
  region text,
  provider text NOT NULL DEFAULT 'square',
  provider_payment_id text,
  amount_cents integer NOT NULL,
  refunded_cents integer NOT NULL DEFAULT 0,
  card_brand text,
  card_last4 text,
  description text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view payment transactions"
ON public.payment_transactions FOR SELECT TO authenticated
USING (public.is_owner(auth.uid()));

CREATE INDEX idx_payment_transactions_booking ON public.payment_transactions (booking_id);
CREATE INDEX idx_payment_transactions_email ON public.payment_transactions (lower(student_email));

CREATE TRIGGER payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  provider_refund_id text,
  amount_cents integer NOT NULL,
  comment text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view payment refunds"
ON public.payment_refunds FOR SELECT TO authenticated
USING (public.is_owner(auth.uid()));

CREATE INDEX idx_payment_refunds_transaction ON public.payment_refunds (transaction_id);