
-- 1) Trust JWT for the caller's email; profile email is no longer authoritative for RLS
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- 2) Dedicated invite code table, creator-only read
CREATE TABLE IF NOT EXISTS public.group_invite_codes (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only group creator can view invite code" ON public.group_invite_codes;
CREATE POLICY "Only group creator can view invite code"
ON public.group_invite_codes
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_invite_codes.group_id AND g.created_by = auth.uid())
);

-- Backfill from existing groups.invite_code
INSERT INTO public.group_invite_codes (group_id, invite_code)
SELECT id, invite_code FROM public.groups
WHERE invite_code IS NOT NULL
ON CONFLICT (group_id) DO NOTHING;

-- Update RPCs to use the new table and stop referencing groups.invite_code from client paths
CREATE OR REPLACE FUNCTION public.get_group_invite_code(p_group_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite_code text;
  v_creator_id uuid;
BEGIN
  SELECT created_by INTO v_creator_id FROM groups WHERE id = p_group_id;
  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  IF v_creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only group creators can view invite codes';
  END IF;
  SELECT invite_code INTO v_invite_code FROM group_invite_codes WHERE group_id = p_group_id;
  RETURN v_invite_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_group_with_code(p_invite_code text, p_user_email text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_group public.groups%ROWTYPE;
  v_user_email text;
  v_group_id uuid;
BEGIN
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_user_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT group_id INTO v_group_id FROM group_invite_codes WHERE invite_code = UPPER(p_invite_code);
  IF v_group_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite code');
  END IF;

  SELECT * INTO v_group FROM groups WHERE id = v_group_id;

  IF v_user_email = ANY(v_group.members) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already a member', 'group_name', v_group.name);
  END IF;

  UPDATE groups SET members = array_append(members, v_user_email) WHERE id = v_group.id;

  RETURN jsonb_build_object('success', true, 'group_id', v_group.id, 'group_name', v_group.name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_group_invite_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_group_with_code(text, text) FROM PUBLIC, anon;

-- Permanently strip the invite_code column from the groups row visible to clients
ALTER TABLE public.groups DROP COLUMN IF EXISTS invite_code;

-- Re-grant explicit column SELECT to authenticated for groups (since invite_code is gone)
GRANT SELECT ON public.groups TO authenticated;
