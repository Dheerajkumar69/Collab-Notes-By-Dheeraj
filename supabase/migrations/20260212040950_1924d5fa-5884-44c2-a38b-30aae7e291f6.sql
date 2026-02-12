
-- ==========================================
-- 1. Note Version History Table
-- ==========================================
CREATE TABLE public.note_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of notes in their groups
CREATE POLICY "Users can view note versions in their groups"
ON public.note_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.notes n
    JOIN public.groups g ON g.id = n.group_id
    WHERE n.id = note_versions.note_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  )
);

-- Only note creators can insert versions (system inserts via trigger)
CREATE POLICY "System can insert note versions"
ON public.note_versions
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Create index for fast lookups
CREATE INDEX idx_note_versions_note_id ON public.note_versions(note_id);
CREATE INDEX idx_note_versions_created_at ON public.note_versions(note_id, created_at DESC);

-- Trigger to auto-save version on note update
CREATE OR REPLACE FUNCTION public.save_note_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only save if title or content changed
  IF OLD.title IS DISTINCT FROM NEW.title OR OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO public.note_versions (note_id, title, content, version_number, created_by)
    VALUES (
      OLD.id,
      OLD.title,
      OLD.content,
      COALESCE((SELECT MAX(version_number) FROM public.note_versions WHERE note_id = OLD.id), 0) + 1,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER save_note_version_trigger
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.save_note_version();

-- ==========================================
-- 2. Folders Table for Note Organization
-- ==========================================
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'default',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Users can view folders in their groups
CREATE POLICY "Users can view folders in their groups"
ON public.folders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = folders.group_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  )
);

-- Users can create folders in their groups
CREATE POLICY "Users can create folders in their groups"
ON public.folders
FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = folders.group_id
    AND (g.created_by = auth.uid() OR get_current_user_email() = ANY(g.members))
  )
);

-- Folder creators can update their folders
CREATE POLICY "Folder creators can update their folders"
ON public.folders
FOR UPDATE
USING (auth.uid() = created_by);

-- Folder creators can delete their folders
CREATE POLICY "Folder creators can delete their folders"
ON public.folders
FOR DELETE
USING (auth.uid() = created_by);

-- Add folder_id to notes table
ALTER TABLE public.notes ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX idx_folders_group_id ON public.folders(group_id);
CREATE INDEX idx_notes_folder_id ON public.notes(folder_id);

-- Enable realtime for note_versions
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
