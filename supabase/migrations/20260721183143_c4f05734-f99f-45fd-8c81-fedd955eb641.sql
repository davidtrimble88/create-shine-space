
-- Discount settings (singleton row)
CREATE TABLE public.discount_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  returning_student_amount_cents INT NOT NULL DEFAULT 7500 CHECK (returning_student_amount_cents >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.discount_settings TO anon, authenticated;
GRANT ALL ON public.discount_settings TO service_role;

ALTER TABLE public.discount_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discount settings"
  ON public.discount_settings FOR SELECT
  USING (true);

CREATE POLICY "Owners and admins can update discount settings"
  ON public.discount_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.discount_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Discount codes (one-time)
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  amount_cents INT,  -- NULL = use current setting at redemption time
  notes TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by_booking_id UUID,
  used_by_email TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view discount codes"
  ON public.discount_codes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can create discount codes"
  ON public.discount_codes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can update discount codes"
  ON public.discount_codes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can delete discount codes"
  ON public.discount_codes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);

-- Booking discount columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_amount_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT,
  ADD COLUMN IF NOT EXISTS discount_code TEXT;
