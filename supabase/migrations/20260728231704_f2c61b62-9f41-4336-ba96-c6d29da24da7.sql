DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'realtime' AND table_name = 'messages'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can only subscribe to their own notification topic" ON realtime.messages';
    EXECUTE $POL$
      CREATE POLICY "Users can only subscribe to their own notification topic"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        -- Notification channels: only the owning user may subscribe
        (
          realtime.topic() LIKE 'notifications:%'
          AND auth.uid()::text = split_part(realtime.topic(), ':', 2)
        )
        OR
        -- Per-user notification postgres_changes channel: only the owning user
        (
          realtime.topic() LIKE 'notif-%'
          AND auth.uid()::text = substring(realtime.topic() from 7)
          AND public.has_any_role(auth.uid())
        )
        OR
        -- Fixed allowlist of app-defined staff channels (no thread ids encoded).
        -- postgres_changes on these topics is still gated by the underlying tables' RLS.
        (
          public.has_any_role(auth.uid())
          AND realtime.topic() IN (
            'messaging-center',
            'sidebar-unread-messages',
            'sidebar-open-tickets',
            'employee-presence',
            'admin-overview-bookings',
            'admin-cancellations',
            'admin-bookings-reschedule-count'
          )
        )
      )
    $POL$;
  END IF;
END $$;