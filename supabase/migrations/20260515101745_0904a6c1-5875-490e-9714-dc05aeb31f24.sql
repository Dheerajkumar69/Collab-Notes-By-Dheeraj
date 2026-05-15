ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS yjs_state bytea,
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'html';

CREATE INDEX IF NOT EXISTS idx_notes_format ON public.notes(format);