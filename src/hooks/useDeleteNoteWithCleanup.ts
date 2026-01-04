import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Attachment {
  url: string;
  name: string;
  type: string;
}

export const useDeleteNoteWithCleanup = () => {
  const deleteNoteWithCleanup = async (noteId: string, attachments?: Attachment[]) => {
    try {
      // First, delete attachments from storage if they exist
      if (attachments && attachments.length > 0) {
        const filePaths = attachments
          .map(att => {
            // Extract the file path from the URL
            const url = att.url;
            const match = url.match(/note-attachments\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter((path): path is string => path !== null);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('note-attachments')
            .remove(filePaths);

          if (storageError) {
            console.error('Failed to delete attachments from storage:', storageError);
            // Continue with note deletion even if storage cleanup fails
          }
        }
      }

      // Delete the note
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (error) throw error;

      toast({ title: 'Success', description: 'Note deleted' });
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to delete note', 
        variant: 'destructive' 
      });
      return false;
    }
  };

  return { deleteNoteWithCleanup };
};
