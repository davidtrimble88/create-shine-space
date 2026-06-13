
-- 1) Restrict incident-reports uploads to staff only
DROP POLICY IF EXISTS "Staff can upload incident report files" ON storage.objects;
CREATE POLICY "Staff can upload incident report files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'incident-reports'
  AND public.has_any_role(auth.uid())
);

-- 2) Realtime authorization: limit subscriptions on notifications channels to the channel owner.
-- Topics are expected to be of the form 'notifications:<user_uuid>'. Generic channels are allowed only for staff.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'realtime' AND table_name = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Users can only subscribe to their own notification topic" ON realtime.messages';
    EXECUTE $POL$
      CREATE POLICY "Users can only subscribe to their own notification topic"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        -- Allow generic broadcast/presence topics for any authenticated staff user
        (
          (realtime.topic() NOT LIKE 'notifications:%')
          AND public.has_any_role(auth.uid())
        )
        OR
        -- For notification channels, only the owning user may read
        (
          realtime.topic() LIKE 'notifications:%'
          AND auth.uid()::text = split_part(realtime.topic(), ':', 2)
        )
      )
    $POL$;
  END IF;
END $$;
