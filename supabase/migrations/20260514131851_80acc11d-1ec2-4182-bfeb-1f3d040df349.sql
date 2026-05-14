ALTER TABLE public.user_presence
  ADD COLUMN IF NOT EXISTS note_id uuid;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_user_presence_note
  ON public.user_presence (note_id, last_seen DESC)
  WHERE note_id IS NOT NULL;
