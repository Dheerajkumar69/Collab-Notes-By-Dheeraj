
-- 1. Storage: drop stale permissive policies on note-attachments
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;

-- 2. Storage: fix broken group-membership policies (used g.name instead of objects.name)
DROP POLICY IF EXISTS "Group members can read note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Group members can update note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Group members can delete note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Group members can upload note attachments" ON storage.objects;

CREATE POLICY "Group members can read note attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(storage.objects.name))[1]
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
  )
);

CREATE POLICY "Group members can upload note attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(storage.objects.name))[1]
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
  )
);

CREATE POLICY "Group members can update note attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(storage.objects.name))[1]
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
  )
);

CREATE POLICY "Group members can delete note attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'note-attachments'
  AND EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id::text = (storage.foldername(storage.objects.name))[1]
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY (g.members))
  )
);

-- 3. Harden join_group_with_code: ignore caller-supplied email, derive from auth.uid()
CREATE OR REPLACE FUNCTION public.join_group_with_code(p_invite_code text, p_user_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_group groups%ROWTYPE;
  v_user_email text;
BEGIN
  -- Always derive email from the authenticated caller; ignore p_user_email
  SELECT email INTO v_user_email FROM profiles WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_group
  FROM groups
  WHERE invite_code = UPPER(p_invite_code);

  IF v_group.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite code');
  END IF;

  IF v_user_email = ANY(v_group.members) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already a member',
      'group_name', v_group.name
    );
  END IF;

  UPDATE groups
  SET members = array_append(members, v_user_email)
  WHERE id = v_group.id;

  RETURN jsonb_build_object(
    'success', true,
    'group_id', v_group.id,
    'group_name', v_group.name
  );
END;
$function$;
