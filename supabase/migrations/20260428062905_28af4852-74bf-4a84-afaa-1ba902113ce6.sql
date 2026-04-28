
-- 1) Restrict EXECUTE on SECURITY DEFINER functions

-- Trigger-only functions: nobody should call directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_note_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_typing_indicators() FROM PUBLIC, anon, authenticated;

-- Internal helper, only called from other SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(text, text, text) FROM PUBLIC, anon, authenticated;

-- Client-callable RPCs: revoke from anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.delete_group_cascade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_group_invite_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_group_with_code(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_group_member(uuid, text) FROM PUBLIC, anon;

-- RLS-helper functions used inside policies need authenticated EXECUTE; revoke anon only
REVOKE EXECUTE ON FUNCTION public.get_current_user_email() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- 2) Lock down avatars bucket SELECT to prevent listing
-- Public CDN URLs (storage/v1/object/public/...) bypass RLS, so images still load.
-- We restrict the RLS policy so the LIST endpoint cannot enumerate files.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Users can view own avatar files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
