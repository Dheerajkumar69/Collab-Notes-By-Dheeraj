
DROP POLICY IF EXISTS "System can insert note versions" ON public.note_versions;
CREATE POLICY "System can insert note versions"
ON public.note_versions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.notes n
    JOIN public.groups g ON g.id = n.group_id
    WHERE n.id = note_versions.note_id
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
  )
);
