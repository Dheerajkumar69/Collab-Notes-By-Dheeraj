-- Phase 1 Continued: Additional Security Fixes

-- Fix: Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (recipient_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Fix: Refactor notifications to use user_id instead of email for better security
-- First, add user_id column
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Migrate existing notifications to use user_id
UPDATE public.notifications n
SET user_id = p.id
FROM public.profiles p
WHERE n.recipient_email = p.email
AND n.user_id IS NULL;

-- Update the notification creation function to use user_id
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
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
  v_email TEXT;
BEGIN
  -- Get user email for backward compatibility
  SELECT email INTO v_email FROM profiles WHERE id = p_user_id;
  
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;
  
  -- Insert notification with both user_id and email
  INSERT INTO notifications (user_id, recipient_email, message, link)
  VALUES (p_user_id, v_email, p_message, p_link)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Update RLS policies to use user_id instead of email
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid());

-- Update the delete policy to use user_id
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (user_id = auth.uid());