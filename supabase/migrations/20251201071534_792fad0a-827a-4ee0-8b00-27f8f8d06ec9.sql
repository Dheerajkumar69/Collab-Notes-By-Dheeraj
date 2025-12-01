-- Phase 1: Critical Security Fixes

-- Fix 1: Restrict profile visibility - users can only see their own profile and profiles of users in their groups
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view group members profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE (
      created_by = auth.uid()
      OR (
        SELECT p.email FROM profiles p WHERE p.id = auth.uid()
      ) = ANY(groups.members)
    )
    AND profiles.email = ANY(groups.members)
  )
);

-- Fix 2: Remove dangerous notification creation policy
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;

-- Notifications should only be created by system/backend functions
-- Create a security definer function for trusted notification creation
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_email TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Verify the recipient exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE email = p_recipient_email) THEN
    RAISE EXCEPTION 'Recipient does not exist';
  END IF;
  
  -- Insert notification
  INSERT INTO notifications (recipient_email, message, link)
  VALUES (p_recipient_email, p_message, p_link)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Fix 3: Set search_path on existing functions to prevent SQL injection
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;