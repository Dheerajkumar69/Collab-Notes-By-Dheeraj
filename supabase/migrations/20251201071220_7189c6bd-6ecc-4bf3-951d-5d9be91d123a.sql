-- Create messages table for group chat
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_edited BOOLEAN DEFAULT false,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in groups they're members of
CREATE POLICY "Users can view messages in their groups"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = messages.group_id
    AND (
      groups.created_by = auth.uid()
      OR (
        SELECT profiles.email
        FROM profiles
        WHERE profiles.id = auth.uid()
      ) = ANY(groups.members)
    )
  )
);

-- Users can create messages in their groups
CREATE POLICY "Users can create messages in their groups"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = messages.group_id
    AND (
      groups.created_by = auth.uid()
      OR (
        SELECT profiles.email
        FROM profiles
        WHERE profiles.id = auth.uid()
      ) = ANY(groups.members)
    )
  )
);

-- Users can update their own messages
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_messages_group_id ON public.messages(group_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;