-- Payment settings table (single-row config)
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active_provider text NOT NULL DEFAULT 'square' CHECK (active_provider IN ('square','paypal','stripe')),
  square_enabled boolean NOT NULL DEFAULT true,
  paypal_enabled boolean NOT NULL DEFAULT false,
  stripe_enabled boolean NOT NULL DEFAULT false,
  square_mode text NOT NULL DEFAULT 'live' CHECK (square_mode IN ('sandbox','live')),
  paypal_mode text NOT NULL DEFAULT 'sandbox' CHECK (paypal_mode IN ('sandbox','live')),
  stripe_mode text NOT NULL DEFAULT 'sandbox' CHECK (stripe_mode IN ('sandbox','live')),
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Enforce singleton row
  singleton boolean NOT NULL DEFAULT true UNIQUE
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated (and even anon for booking checkout) can read which provider is active
CREATE POLICY "Anyone can view payment settings"
  ON public.payment_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only owners can insert
CREATE POLICY "Owners can insert payment settings"
  ON public.payment_settings FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Only owners can update
CREATE POLICY "Owners can update payment settings"
  ON public.payment_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

-- Updated-at trigger
CREATE TRIGGER set_payment_settings_updated_at
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed the singleton row
INSERT INTO public.payment_settings (active_provider, square_enabled, paypal_enabled, stripe_enabled)
VALUES ('square', true, false, false);

-- Track which provider processed each booking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_provider text;