-- Replace the author-only update policy with a group-member-wide one.
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;

CREATE POLICY "Group members can update notes"
ON public.notes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = notes.group_id
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = notes.group_id
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);