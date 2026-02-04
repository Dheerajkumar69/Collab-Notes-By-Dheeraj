-- Add lecture and topic fields to notes for class note organization
ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS lecture_number INTEGER,
ADD COLUMN IF NOT EXISTS topic TEXT;

-- Add index for efficient sorting by lecture number
CREATE INDEX IF NOT EXISTS idx_notes_lecture_number ON public.notes (group_id, lecture_number);