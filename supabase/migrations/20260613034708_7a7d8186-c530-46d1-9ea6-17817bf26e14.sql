
-- Subscriptions registered by users for web push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Ensure pg_net is available for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger: when a row is inserted into notifications, fan out to web push
CREATE OR REPLACE FUNCTION public.on_notification_insert_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url TEXT := 'https://tdoyunayplyrmdixhvmn.supabase.co';
BEGIN
  -- Fire and forget; failures here must not block the notification insert
  BEGIN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title',   NEW.title,
        'body',    NEW.body,
        'link',    NEW.link,
        'type',    NEW.type,
        'notification_id', NEW.id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_push_fanout ON public.notifications;
CREATE TRIGGER notifications_push_fanout
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.on_notification_insert_push();
