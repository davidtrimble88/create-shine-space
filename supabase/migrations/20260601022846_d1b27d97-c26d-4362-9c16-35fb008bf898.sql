-- Auto email templates managed by Owner/Admin
CREATE TABLE public.auto_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_event text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  subject text NOT NULL,
  body text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  available_variables text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_email_templates TO authenticated;
GRANT ALL ON public.auto_email_templates TO service_role;

ALTER TABLE public.auto_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view auto email templates"
  ON public.auto_email_templates FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can insert auto email templates"
  ON public.auto_email_templates FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can update auto email templates"
  ON public.auto_email_templates FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can delete auto email templates"
  ON public.auto_email_templates FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_auto_email_templates_updated_at
  BEFORE UPDATE ON public.auto_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default registration confirmation template
INSERT INTO public.auto_email_templates (trigger_event, name, description, subject, body, available_variables)
VALUES (
  'registration_confirmation',
  'Registration Confirmation',
  'Sent automatically to a student after they complete registration for a course.',
  'Your registration for {{course}} is confirmed',
  E'Hi {{firstName}},\n\nThank you for registering for the {{course}} at our {{locationLabel}} location.\n\nClass Date: {{scheduleDate}}\nSchedule: {{schedule}}\n\nWhat to bring:\n- Valid driver''s license or permit\n- Long sleeves, long pants, and over-the-ankle boots\n- Sunglasses or eye protection\n\nA bike and helmet will be provided.\n\nIf you have any questions, just reply to this email.\n\nSee you on the range!\nLearn to Ride VC',
  ARRAY['firstName','lastName','course','locationLabel','scheduleDate','schedule','fee','email']
);