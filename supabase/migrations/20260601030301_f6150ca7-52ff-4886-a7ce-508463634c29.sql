
ALTER TABLE public.auto_email_templates
  ADD COLUMN IF NOT EXISTS match_location text,
  ADD COLUMN IF NOT EXISTS match_group text;

CREATE INDEX IF NOT EXISTS auto_email_templates_match_idx
  ON public.auto_email_templates (trigger_event, match_location, match_group);
