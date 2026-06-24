-- Lock down internal trigger-only SECURITY DEFINER functions so authenticated users cannot invoke them via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.update_updated_at()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_note_version()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_typing_indicators() FROM PUBLIC, anon, authenticated;