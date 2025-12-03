-- Create a security definer function to get current user's email without RLS checks
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid()
$$;

-- Drop problematic profiles policies that cause recursion
DROP POLICY IF EXISTS "Users can view group member profiles" ON public.profiles;

-- Create simpler profiles policy - users can view their own profile
-- The "Users can view own profile" policy already exists, so we just need to add a policy
-- for viewing other members in shared groups using the security definer function

CREATE POLICY "Users can view profiles in their groups"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid() 
  OR 
  email IN (
    SELECT UNNEST(g.members) 
    FROM public.groups g 
    WHERE g.created_by = auth.uid() 
    OR public.get_current_user_email() = ANY(g.members)
  )
  OR
  id IN (
    SELECT g.created_by 
    FROM public.groups g 
    WHERE g.created_by = auth.uid() 
    OR public.get_current_user_email() = ANY(g.members)
  )
);

-- Update groups SELECT policy to use the security definer function
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

CREATE POLICY "Users can view groups they are members of"
ON public.groups
FOR SELECT
USING (
  auth.uid() = created_by 
  OR public.get_current_user_email() = ANY(members)
);

-- Update notes SELECT policy
DROP POLICY IF EXISTS "Users can view notes in their groups" ON public.notes;

CREATE POLICY "Users can view notes in their groups"
ON public.notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = notes.group_id
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

-- Update notes INSERT policy
DROP POLICY IF EXISTS "Users can create notes in their groups" ON public.notes;

CREATE POLICY "Users can create notes in their groups"
ON public.notes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = notes.group_id
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

-- Update messages SELECT policy
DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.messages;

CREATE POLICY "Users can view messages in their groups"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = messages.group_id
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

-- Update messages INSERT policy
DROP POLICY IF EXISTS "Users can create messages in their groups" ON public.messages;

CREATE POLICY "Users can create messages in their groups"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = messages.group_id
    AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);