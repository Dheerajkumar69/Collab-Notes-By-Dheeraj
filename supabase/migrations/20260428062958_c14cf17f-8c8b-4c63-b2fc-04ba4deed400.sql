
-- 1) Realtime: enable RLS and require group membership for topic subscription
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to group topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to group topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow postgres_changes (no topic) — RLS on the underlying tables already gates row visibility
  realtime.topic() IS NULL
  OR realtime.topic() = ''
  -- For named broadcast/presence channels, require the topic to be a group_id the user belongs to,
  -- or a topic that does not look like a group UUID (e.g., user-scoped channels).
  OR NOT (realtime.topic() ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = realtime.topic()
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
  )
);

-- 2) Profiles: enforce that inserted email matches the authenticated user's verified email
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND email = (auth.jwt() ->> 'email')
);

-- 3) note_templates: restrict the system-templates SELECT policy to authenticated users
DROP POLICY IF EXISTS "Anyone can view system templates" ON public.note_templates;
CREATE POLICY "Authenticated users can view system templates"
ON public.note_templates
FOR SELECT
TO authenticated
USING (is_system = true);
