-- Atomic member removal (eliminates TOCTOU race)
CREATE OR REPLACE FUNCTION public.remove_group_member(
  p_group_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  SELECT created_by INTO v_creator_id FROM groups WHERE id = p_group_id;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the group creator can remove members';
  END IF;

  -- Atomic remove
  UPDATE groups
  SET members = array_remove(members, p_email)
  WHERE id = p_group_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Safe cascading delete for groups (cleans up all related rows in one transaction)
CREATE OR REPLACE FUNCTION public.delete_group_cascade(
  p_group_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
BEGIN
  SELECT created_by INTO v_creator_id FROM groups WHERE id = p_group_id;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the group creator can delete this group';
  END IF;

  -- Delete dependent data first (no FK cascades exist)
  DELETE FROM message_read_receipts
    WHERE message_id IN (SELECT id FROM messages WHERE group_id = p_group_id);
  DELETE FROM messages WHERE group_id = p_group_id;
  DELETE FROM note_versions
    WHERE note_id IN (SELECT id FROM notes WHERE group_id = p_group_id);
  DELETE FROM note_reminders WHERE group_id = p_group_id;
  DELETE FROM notes WHERE group_id = p_group_id;
  DELETE FROM folders WHERE group_id = p_group_id;
  DELETE FROM typing_indicators WHERE group_id = p_group_id;
  DELETE FROM user_presence WHERE group_id = p_group_id;
  DELETE FROM activity_log WHERE group_id = p_group_id;
  DELETE FROM groups WHERE id = p_group_id;

  RETURN jsonb_build_object('success', true);
END;
$$;