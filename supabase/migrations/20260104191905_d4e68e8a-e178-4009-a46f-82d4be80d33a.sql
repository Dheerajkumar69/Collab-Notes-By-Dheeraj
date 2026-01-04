-- Add reactions column to messages table for message reactions
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '[]'::jsonb;

-- Add attachments column to messages table for file sharing
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Create typing_indicators table for realtime typing status
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on typing_indicators
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Create policies for typing indicators
CREATE POLICY "Users can view typing indicators in their groups"
ON public.typing_indicators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = typing_indicators.group_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  )
);

CREATE POLICY "Users can insert their own typing indicator"
ON public.typing_indicators
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = typing_indicators.group_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  )
);

CREATE POLICY "Users can update their own typing indicator"
ON public.typing_indicators
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own typing indicator"
ON public.typing_indicators
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for typing_indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_typing_indicators_group_id ON public.typing_indicators(group_id);

-- Create function to cleanup old typing indicators (older than 5 seconds)
CREATE OR REPLACE FUNCTION public.cleanup_typing_indicators()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM typing_indicators
  WHERE updated_at < NOW() - INTERVAL '5 seconds';
END;
$$;