
DROP POLICY IF EXISTS "Authenticated users can subscribe to group topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to group topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = realtime.topic()
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
  )
);
