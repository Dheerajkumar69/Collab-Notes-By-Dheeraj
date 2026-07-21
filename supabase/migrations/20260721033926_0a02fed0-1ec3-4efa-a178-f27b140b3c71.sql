
-- Bulletproof helper: check group membership by auth.uid() without depending on JWT email claim
CREATE OR REPLACE FUNCTION public.is_group_accessible(gid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE g.id = gid
      AND (
        g.created_by = auth.uid()
        OR (p.email IS NOT NULL AND p.email = ANY(g.members))
        OR (lower(coalesce(auth.jwt() ->> 'email','')) <> '' AND lower(auth.jwt() ->> 'email') = ANY(g.members))
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_accessible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_accessible(uuid) TO authenticated, service_role;

-- Rewrite note-attachments storage policies to use the bulletproof helper
DROP POLICY IF EXISTS "Group members can read note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Group members can upload note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Group members can update note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Group members can delete note attachments" ON storage.objects;

CREATE POLICY "Group members can read note attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'note-attachments'
  AND public.is_group_accessible(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Group members can upload note attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'note-attachments'
  AND public.is_group_accessible(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Group members can update note attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'note-attachments'
  AND public.is_group_accessible(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Group members can delete note attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'note-attachments'
  AND public.is_group_accessible(((storage.foldername(name))[1])::uuid)
);
