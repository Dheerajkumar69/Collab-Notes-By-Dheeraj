
-- 1) Profiles: lock email immutability against the JWT email (not a self-referential subquery)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND email = (auth.jwt() ->> 'email')
);

-- 2) Groups: hide invite_code via column-level privilege; only creators read it through the RPC
REVOKE SELECT (invite_code) ON public.groups FROM anon, authenticated;
-- Re-grant SELECT on every other column to authenticated so existing queries keep working
GRANT SELECT (
  id, name, description, created_at, created_by,
  background_image_url, members, color
) ON public.groups TO authenticated;

-- 3) Feedback: require the inserted user_email to match the JWT email
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;
CREATE POLICY "Users can create feedback"
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND user_email = (auth.jwt() ->> 'email')
);

-- 4) Storage: drop overly broad group-level update/delete on note-attachments
DROP POLICY IF EXISTS "Group members can update note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Group members can delete note attachments" ON storage.objects;
-- Owner-only update/delete policies already exist ("Users can update/delete own attachments")
