-- Create a secure function to handle group joining
CREATE OR REPLACE FUNCTION public.join_group_with_code(
  p_invite_code TEXT,
  p_user_email TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group groups%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Find the group with the invite code
  SELECT * INTO v_group
  FROM groups
  WHERE invite_code = UPPER(p_invite_code);
  
  -- Check if group exists
  IF v_group.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid invite code'
    );
  END IF;
  
  -- Check if user is already a member
  IF p_user_email = ANY(v_group.members) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already a member',
      'group_name', v_group.name
    );
  END IF;
  
  -- Add user to members array
  UPDATE groups
  SET members = array_append(members, p_user_email)
  WHERE id = v_group.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group.id,
    'group_name', v_group.name
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.join_group_with_code(TEXT, TEXT) TO authenticated;