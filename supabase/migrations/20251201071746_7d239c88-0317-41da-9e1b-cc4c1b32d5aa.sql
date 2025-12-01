-- Phase 1: Final Security Hardening

-- Fix 1: Remove the security definer view and use standard view with RLS
DROP VIEW IF EXISTS public.group_member_profiles;

-- The profiles table already has proper RLS, so we don't need a special view
-- Components should just use profiles table directly with proper access control

-- Fix 2: Make recipient_email nullable and plan for deprecation
ALTER TABLE public.notifications ALTER COLUMN recipient_email DROP NOT NULL;

-- Add comment explaining the field is deprecated
COMMENT ON COLUMN public.notifications.recipient_email IS 'DEPRECATED: Use user_id instead. This field is kept for backward compatibility only.';

-- Fix 3: Update profiles RLS to be more restrictive
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view group members profiles" ON public.profiles;

-- Users can only view their own full profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Users can view limited info of group members (no email)
-- This will be handled at application layer to hide email from UI