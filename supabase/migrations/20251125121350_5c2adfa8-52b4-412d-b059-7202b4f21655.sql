-- Phase 1.1: Fix storage policies only

-- Fix storage policies to use owner-based access control
DROP POLICY IF EXISTS "Users can update their attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their attachments" ON storage.objects;

CREATE POLICY "Users can update own attachments"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'note-attachments' AND 
    (owner)::uuid = auth.uid()
  );

CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'note-attachments' AND 
    (owner)::uuid = auth.uid()
  );