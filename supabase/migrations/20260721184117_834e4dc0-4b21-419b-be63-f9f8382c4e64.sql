
-- 1. discount_settings: rename existing column and add new amount columns
ALTER TABLE public.discount_settings
  RENAME COLUMN returning_student_amount_cents TO intermediate_returning_amount_cents;

ALTER TABLE public.discount_settings
  ADD COLUMN IF NOT EXISTS advanced_returning_amount_cents integer NOT NULL DEFAULT 7500,
  ADD COLUMN IF NOT EXISTS promo_default_amount_cents integer NOT NULL DEFAULT 5000;

-- 2. discount_codes: add promotional-code fields
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS applies_to_courses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS usage_type text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_usage_type_check;
ALTER TABLE public.discount_codes
  ADD CONSTRAINT discount_codes_usage_type_check
  CHECK (usage_type IN ('one_time','multi_use'));

CREATE INDEX IF NOT EXISTS idx_discount_codes_code_lower ON public.discount_codes (lower(code));
