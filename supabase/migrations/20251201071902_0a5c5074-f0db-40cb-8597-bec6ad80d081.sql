-- CRITICAL FIX: Ensure all policies require authentication

-- Update all SELECT policies to require authentication
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view group member profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can view group member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE (
      g.created_by = auth.uid()
      OR (SELECT p.email FROM profiles p WHERE p.id = auth.uid()) = ANY(g.members)
    )
    AND (
      profiles.email = ANY(g.members)
      OR profiles.id = g.created_by
    )
  )
);