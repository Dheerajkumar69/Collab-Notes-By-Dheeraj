
REVOKE EXECUTE ON FUNCTION public.join_group_with_code(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_group_invite_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_group_member(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_group_cascade(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_notification(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_current_user_email() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_typing_indicators() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.join_group_with_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_group_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
