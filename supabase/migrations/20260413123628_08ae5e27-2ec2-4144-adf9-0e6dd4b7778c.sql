
-- 1. Make note-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'note-attachments';

-- 2. Drop existing permissive storage policies on note-attachments
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for note-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own note attachments" ON storage.objects;

-- 3. Create group-membership-scoped storage policies
-- Read: only group members can read attachments (path = groupId/filename)
CREATE POLICY "Group members can read note attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(name))[1]
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

-- Upload: only group members can upload to their group folder
CREATE POLICY "Group members can upload note attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(name))[1]
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

-- Update: same as upload
CREATE POLICY "Group members can update note attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(name))[1]
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

-- Delete: group members can delete
CREATE POLICY "Group members can delete note attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(name))[1]
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);
