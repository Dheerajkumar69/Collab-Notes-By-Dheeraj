CREATE OR REPLACE FUNCTION public.get_group_invite_code(p_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite_code text;
  v_user_email text;
  v_is_member boolean;
BEGIN
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_user_email = '' THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM groups
    WHERE id = p_group_id
      AND (created_by = auth.uid() OR v_user_email = ANY(members))
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  SELECT invite_code INTO v_invite_code FROM group_invite_codes WHERE group_id = p_group_id;
  RETURN v_invite_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_invite_code(uuid) TO authenticated;