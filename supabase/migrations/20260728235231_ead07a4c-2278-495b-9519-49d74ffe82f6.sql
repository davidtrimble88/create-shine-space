-- Fix 1: Scope admin-only realtime topics to admin/manager/owner
DROP POLICY IF EXISTS "Users can only subscribe to their own notification topic" ON realtime.messages;

CREATE POLICY "Users can only subscribe to their own notification topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    realtime.topic() LIKE 'notifications:%'
    AND (auth.uid())::text = split_part(realtime.topic(), ':', 2)
  )
  OR (
    realtime.topic() LIKE 'notif-%'
    AND (auth.uid())::text = substring(realtime.topic() FROM 7)
    AND public.has_any_role(auth.uid())
  )
  OR (
    public.has_any_role(auth.uid())
    AND realtime.topic() = ANY (ARRAY[
      'messaging-center',
      'sidebar-unread-messages',
      'sidebar-open-tickets',
      'employee-presence'
    ])
  )
  OR (
    realtime.topic() = ANY (ARRAY[
      'admin-overview-bookings',
      'admin-cancellations',
      'admin-bookings-reschedule-count'
    ])
    AND (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  )
);

-- Fix 2: Prevent anonymous listing of employee-photos bucket contents.
-- Direct URLs still work because the bucket is public; only object listing is restricted.
DROP POLICY IF EXISTS "Employee photos public read" ON storage.objects;

CREATE POLICY "Employee photos staff list"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'employee-photos'
  AND public.has_any_role(auth.uid())
);