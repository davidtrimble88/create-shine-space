
CREATE TABLE public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_broadcast BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_threads TO authenticated;
GRANT ALL ON public.message_threads TO service_role;

CREATE TABLE public.message_thread_participants (
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_thread_participants TO authenticated;
GRANT ALL ON public.message_thread_participants TO service_role;

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

CREATE INDEX idx_messages_thread ON public.messages(thread_id, created_at);
CREATE INDEX idx_participants_user ON public.message_thread_participants(user_id);
CREATE INDEX idx_threads_last_message ON public.message_threads(last_message_at DESC);

-- Helper: is user participant?
CREATE OR REPLACE FUNCTION public.is_thread_participant(_thread UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.message_thread_participants WHERE thread_id = _thread AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.can_start_thread(_user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role IN ('owner','admin'));
$$;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Threads
CREATE POLICY "Participants or creator view threads" ON public.message_threads
  FOR SELECT TO authenticated USING (
    created_by = auth.uid() OR public.is_thread_participant(id, auth.uid())
  );
CREATE POLICY "Admins create threads" ON public.message_threads
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND public.can_start_thread(auth.uid())
  );
CREATE POLICY "Creator updates thread" ON public.message_threads
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator deletes thread" ON public.message_threads
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Participants
CREATE POLICY "View own or admin participants" ON public.message_thread_participants
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = thread_id AND t.created_by = auth.uid())
    OR public.is_thread_participant(thread_id, auth.uid())
  );
CREATE POLICY "Admin adds participants" ON public.message_thread_participants
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = thread_id AND t.created_by = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "User updates own read state" ON public.message_thread_participants
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Creator removes participants" ON public.message_thread_participants
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = thread_id AND t.created_by = auth.uid())
    OR user_id = auth.uid()
  );

-- Messages
CREATE POLICY "Participants view messages" ON public.messages
  FOR SELECT TO authenticated USING (
    public.is_thread_participant(thread_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = thread_id AND t.created_by = auth.uid())
  );
CREATE POLICY "Participants send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND (
      public.is_thread_participant(thread_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = thread_id AND t.created_by = auth.uid())
    )
  );
CREATE POLICY "Sender edits own messages" ON public.messages
  FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Sender deletes own messages" ON public.messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- Trigger: bump thread + notify others on new message
CREATE OR REPLACE FUNCTION public.on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; subj TEXT; sender_name TEXT;
BEGIN
  UPDATE public.message_threads SET last_message_at = now() WHERE id = NEW.thread_id;
  SELECT subject INTO subj FROM public.message_threads WHERE id = NEW.thread_id;
  SELECT COALESCE(full_name, email) INTO sender_name FROM public.employees WHERE user_id = NEW.sender_id LIMIT 1;
  IF sender_name IS NULL THEN sender_name := 'Someone'; END IF;

  FOR r IN
    SELECT user_id FROM public.message_thread_participants
    WHERE thread_id = NEW.thread_id AND user_id <> NEW.sender_id
  LOOP
    PERFORM public.notify_user(
      r.user_id, 'message_new',
      'New message: ' || COALESCE(subj, ''),
      sender_name || ': ' || LEFT(NEW.body, 140),
      '/employee-dashboard?tab=messages'
    );
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.on_new_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_thread_participants;
