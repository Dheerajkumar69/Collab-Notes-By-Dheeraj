-- Add telegram sync tracking columns to notes
ALTER TABLE public.notes 
ADD COLUMN telegram_message_id TEXT DEFAULT NULL,
ADD COLUMN telegram_file_id TEXT DEFAULT NULL,
ADD COLUMN is_archived BOOLEAN DEFAULT false;

-- Create index for faster archive queries
CREATE INDEX idx_notes_archived ON public.notes(is_archived, created_at);
CREATE INDEX idx_notes_telegram_sync ON public.notes(telegram_message_id);