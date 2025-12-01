-- Phase 1 Final: Protect Sensitive Data from Group Members

-- Create a secure view for group member profiles that hides email addresses
CREATE OR REPLACE VIEW public.group_member_profiles AS
SELECT 
  p.id,
  p.full_name,
  p.created_at,
  -- Email is only visible to the user themselves
  CASE 
    WHEN p.id = auth.uid() THEN p.email
    ELSE NULL
  END as email
FROM public.profiles p;

-- Grant access to authenticated users
GRANT SELECT ON public.group_member_profiles TO authenticated;

-- Create a secure function to get invite code (only for group creators)
CREATE OR REPLACE FUNCTION public.get_group_invite_code(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_code TEXT;
  v_creator_id UUID;
BEGIN
  -- Get the group creator
  SELECT created_by INTO v_creator_id
  FROM groups
  WHERE id = p_group_id;
  
  -- Check if current user is the creator
  IF v_creator_id != auth.uid() THEN
    RAISE EXCEPTION 'Only group creators can view invite codes';
  END IF;
  
  -- Return the invite code
  SELECT invite_code INTO v_invite_code
  FROM groups
  WHERE id = p_group_id;
  
  RETURN v_invite_code;
END;
$$;

-- Add explicit INSERT policy for notifications (deny direct inserts)
CREATE POLICY "Prevent direct notification creation"
ON public.notifications
FOR INSERT
WITH CHECK (false);

-- Add comment explaining notification creation should use the function
COMMENT ON TABLE public.notifications IS 'Notifications can only be created using the create_notification() function. Direct INSERT is blocked for security.';

-- Add a constraint to ensure notifications created after this point have user_id
ALTER TABLE public.notifications 
ALTER COLUMN user_id SET NOT NULL;