-- Drop stale permissive storage policies that bypass group-scoped access on note attachments.
-- These were created in 20251017111809 and never properly removed; PostgreSQL OR-evaluates
-- permissive policies, so they nullify our group-membership checks.
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their attachments" ON storage.objects;