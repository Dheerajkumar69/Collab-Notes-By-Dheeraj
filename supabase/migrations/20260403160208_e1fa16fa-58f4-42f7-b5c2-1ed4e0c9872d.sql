
-- User presence table
CREATE TABLE public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view presence" ON public.user_presence
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM groups g WHERE g.id = user_presence.group_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  ));

CREATE POLICY "Users can upsert own presence" ON public.user_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence" ON public.user_presence
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presence" ON public.user_presence
  FOR DELETE USING (auth.uid() = user_id);

-- Message read receipts
CREATE TABLE public.message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view read receipts" ON public.message_read_receipts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM messages m JOIN groups g ON g.id = m.group_id
    WHERE m.id = message_read_receipts.message_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  ));

CREATE POLICY "Users can create own read receipts" ON public.message_read_receipts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Activity log
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view activity" ON public.activity_log
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM groups g WHERE g.id = activity_log.group_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  ));

CREATE POLICY "Group members can create activity" ON public.activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM groups g WHERE g.id = activity_log.group_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  ));

-- Note reminders
CREATE TABLE public.note_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  due_date timestamp with time zone NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.note_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders" ON public.note_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reminders" ON public.note_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders" ON public.note_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" ON public.note_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- Note templates
CREATE TABLE public.note_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system templates" ON public.note_templates
  FOR SELECT USING (is_system = true);

CREATE POLICY "Users can view own templates" ON public.note_templates
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create own templates" ON public.note_templates
  FOR INSERT WITH CHECK (auth.uid() = created_by AND is_system = false);

CREATE POLICY "Users can update own templates" ON public.note_templates
  FOR UPDATE USING (auth.uid() = created_by AND is_system = false);

CREATE POLICY "Users can delete own templates" ON public.note_templates
  FOR DELETE USING (auth.uid() = created_by AND is_system = false);

-- Add due_date to notes
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
