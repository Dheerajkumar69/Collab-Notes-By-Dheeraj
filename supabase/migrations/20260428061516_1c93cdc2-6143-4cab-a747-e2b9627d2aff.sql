-- Harden profiles SELECT policies: restrict to authenticated role only,
-- and ensure email is only visible to: self, admins, or fellow group members.

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their groups" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Self
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fellow group members only (no anon, no broad authenticated access)
CREATE POLICY "Users can view profiles in their groups"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE
      (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
      AND (
        profiles.email = ANY (g.members)
        OR profiles.id = g.created_by
      )
  )
);