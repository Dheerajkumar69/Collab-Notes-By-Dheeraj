
DROP POLICY IF EXISTS "Users can create own reminders" ON public.note_reminders;
DROP POLICY IF EXISTS "Users can view own reminders" ON public.note_reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON public.note_reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON public.note_reminders;

CREATE POLICY "Users can create own reminders"
ON public.note_reminders
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.notes n
    JOIN public.groups g ON g.id = n.group_id
    WHERE n.id = note_reminders.note_id
      AND n.group_id = note_reminders.group_id
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

CREATE POLICY "Users can view own reminders"
ON public.note_reminders
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
ON public.note_reminders
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.notes n
    JOIN public.groups g ON g.id = n.group_id
    WHERE n.id = note_reminders.note_id
      AND n.group_id = note_reminders.group_id
      AND (g.created_by = auth.uid() OR public.get_current_user_email() = ANY(g.members))
  )
);

CREATE POLICY "Users can delete own reminders"
ON public.note_reminders
FOR DELETE
USING (auth.uid() = user_id);
