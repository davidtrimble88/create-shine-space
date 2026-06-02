CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.it_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text,
  author_role text NOT NULL DEFAULT 'user',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id, created_at);

GRANT SELECT, INSERT ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments on accessible tickets"
ON public.ticket_comments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
  OR EXISTS (SELECT 1 FROM public.it_tickets t WHERE t.id = ticket_comments.ticket_id AND t.user_id = auth.uid())
);

CREATE POLICY "Insert comments on accessible tickets"
ON public.ticket_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'owner'::app_role)
    OR EXISTS (SELECT 1 FROM public.it_tickets t WHERE t.id = ticket_comments.ticket_id AND t.user_id = auth.uid())
  )
);

CREATE POLICY "Admins and owners can delete comments"
ON public.ticket_comments FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));
GRANT DELETE ON public.ticket_comments TO authenticated;