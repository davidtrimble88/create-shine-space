CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_payment_id_key
  ON public.payment_transactions (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;