
-- Realtime: require any subscribed topic to be a UUID for a group the user belongs to.
-- (postgres_changes uses NULL/empty topic and is gated by per-table RLS.)
DROP POLICY IF EXISTS "Authenticated users can subscribe to group topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to group topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IS NULL
  OR realtime.topic() = ''
  OR (
    realtime.topic() ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id::text = realtime.topic()
        AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
    )
  )
);

-- note_templates: scope INSERT to authenticated users only
DROP POLICY IF EXISTS "Users can create own templates" ON public.note_templates;
CREATE POLICY "Users can create own templates"
ON public.note_templates
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by AND is_system = false);

-- Also scope existing user-template SELECT/UPDATE/DELETE to authenticated for clarity
DROP POLICY IF EXISTS "Users can view own templates" ON public.note_templates;
CREATE POLICY "Users can view own templates"
ON public.note_templates FOR SELECT TO authenticated
USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update own templates" ON public.note_templates;
CREATE POLICY "Users can update own templates"
ON public.note_templates FOR UPDATE TO authenticated
USING (auth.uid() = created_by AND is_system = false);

DROP POLICY IF EXISTS "Users can delete own templates" ON public.note_templates;
CREATE POLICY "Users can delete own templates"
ON public.note_templates FOR DELETE TO authenticated
USING (auth.uid() = created_by AND is_system = false);
