import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Note } from '@/types';

export const useTelegramSync = () => {
  const syncNoteToTelegram = async (note: Note) => {
    try {
      const { data, error } = await supabase.functions.invoke('telegram-sync', {
        body: { action: 'sync', note },
      });

      if (error) throw error;
      
      console.log('Note synced to Telegram:', data);
      return data;
    } catch (error) {
      console.error('Failed to sync note to Telegram:', error);
      // Don't show toast for background sync - just log
      return null;
    }
  };

  const archiveNote = async (noteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('telegram-sync', {
        body: { action: 'archive', noteId },
      });

      if (error) throw error;
      
      toast({
        title: 'Note archived',
        description: 'Note content moved to Telegram storage',
      });
      
      return data;
    } catch (error) {
      console.error('Failed to archive note:', error);
      toast({
        title: 'Archive failed',
        description: 'Could not archive note to Telegram',
        variant: 'destructive',
      });
      return null;
    }
  };

  const unarchiveNote = async (noteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('telegram-sync', {
        body: { action: 'unarchive', noteId },
      });

      if (error) throw error;
      
      toast({
        title: 'Note restored',
        description: 'Note content retrieved from Telegram',
      });
      
      return data;
    } catch (error) {
      console.error('Failed to unarchive note:', error);
      toast({
        title: 'Restore failed',
        description: 'Could not retrieve note from Telegram',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteFromTelegram = async (noteId: string) => {
    try {
      await supabase.functions.invoke('telegram-sync', {
        body: { action: 'delete', noteId },
      });
    } catch (error) {
      console.error('Failed to delete from Telegram:', error);
    }
  };

  const bulkSyncNotes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('telegram-sync', {
        body: { action: 'bulk-sync' },
      });

      if (error) throw error;
      
      toast({
        title: 'Bulk sync complete',
        description: `Synced ${data.synced} notes to Telegram`,
      });
      
      return data;
    } catch (error) {
      console.error('Failed to bulk sync:', error);
      toast({
        title: 'Sync failed',
        description: 'Could not sync notes to Telegram',
        variant: 'destructive',
      });
      return null;
    }
  };

  const autoArchiveOldNotes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('telegram-sync', {
        body: { action: 'auto-archive' },
      });

      if (error) throw error;
      
      if (data.archived > 0) {
        toast({
          title: 'Auto-archive complete',
          description: `Archived ${data.archived} old notes to Telegram`,
        });
      }
      
      return data;
    } catch (error) {
      console.error('Failed to auto-archive:', error);
      return null;
    }
  };

  return {
    syncNoteToTelegram,
    archiveNote,
    unarchiveNote,
    deleteFromTelegram,
    bulkSyncNotes,
    autoArchiveOldNotes,
  };
};
