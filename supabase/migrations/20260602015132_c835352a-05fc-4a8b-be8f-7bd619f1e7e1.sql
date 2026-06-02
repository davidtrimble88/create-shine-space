
CREATE TABLE public.it_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  submitter_email text NOT NULL,
  submitter_name text,
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_tickets TO authenticated;
GRANT ALL ON public.it_tickets TO service_role;

ALTER TABLE public.it_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
ON public.it_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins and owners can view all tickets"
ON public.it_tickets FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Authenticated users can create tickets"
ON public.it_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own open tickets"
ON public.it_tickets FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'open');

CREATE POLICY "Admins and owners can update tickets"
ON public.it_tickets FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins and owners can delete tickets"
ON public.it_tickets FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER it_tickets_updated_at
BEFORE UPDATE ON public.it_tickets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
