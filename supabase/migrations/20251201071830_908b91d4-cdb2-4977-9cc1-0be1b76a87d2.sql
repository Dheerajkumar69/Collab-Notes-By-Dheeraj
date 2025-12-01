-- Fix: Correct policy to allow users to view group member profiles
CREATE POLICY "Users can view group member profiles"
ON public.profiles
FOR SELECT
USING (
  -- Can see profiles where the email is in any group's members array that the user is also in
  EXISTS (
    SELECT 1 FROM groups g
    WHERE (
      -- User is in this group
      g.created_by = auth.uid()
      OR (SELECT p.email FROM profiles p WHERE p.id = auth.uid()) = ANY(g.members)
    )
    AND (
      -- And the profile belongs to someone in this group
      profiles.email = ANY(g.members)
      OR profiles.id = g.created_by
    )
  )
);