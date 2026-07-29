-- 1) Drop the anonymous/authenticated blanket upload policy on id-photos
DROP POLICY IF EXISTS "Anyone can upload id photos to dated UUID path" ON storage.objects;

-- 2) Replace the realtime broadcast-topic policy so shared sidebar/messaging
--    channels are scoped per-user (topic must end with ":<auth.uid()>").
DROP POLICY IF EXISTS "Users can only subscribe to their own notification topic" ON realtime.messages;

CREATE POLICY "Users can only subscribe to their own notification topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Per-user notification topics
  (
    realtime.topic() LIKE 'notifications:%'
    AND (auth.uid())::text = split_part(realtime.topic(), ':', 2)
  )
  OR (
    realtime.topic() LIKE 'notif-%'
    AND (auth.uid())::text = substring(realtime.topic() FROM 7)
    AND has_any_role(auth.uid())
  )
  -- Staff-only presence channel (no message content, just online status)
  OR (
    realtime.topic() = 'employee-presence'
    AND has_any_role(auth.uid())
  )
  -- Per-user staff sidebar/messaging channels: "<name>:<uid>"
  OR (
    has_any_role(auth.uid())
    AND (
      realtime.topic() LIKE 'messaging-center:%'
      OR realtime.topic() LIKE 'sidebar-unread-messages:%'
      OR realtime.topic() LIKE 'sidebar-open-tickets:%'
    )
    AND (auth.uid())::text = split_part(realtime.topic(), ':', 2)
  )
  -- Admin overview broadcast topics remain restricted to owner/admin/manager
  OR (
    realtime.topic() = ANY (ARRAY[
      'admin-overview-bookings',
      'admin-cancellations',
      'admin-bookings-reschedule-count'
    ])
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  )
);