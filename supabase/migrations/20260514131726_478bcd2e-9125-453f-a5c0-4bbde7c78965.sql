ALTER TABLE public.note_reminders
  ADD COLUMN IF NOT EXISTS reminded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'note_reminders_recurrence_check'
  ) THEN
    ALTER TABLE public.note_reminders
      ADD CONSTRAINT note_reminders_recurrence_check
      CHECK (recurrence IN ('none','daily','weekly','monthly'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_note_reminders_due
  ON public.note_reminders (due_date)
  WHERE is_completed = false AND reminded = false;
