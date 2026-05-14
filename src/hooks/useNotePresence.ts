import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface NoteViewer {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  editing?: boolean;
}

/**
 * Soft-collaboration hook for note pages.
 *
 * - Uses Supabase Realtime presence on a per-note channel to track who is viewing.
 * - Broadcasts an "editing" flag so other viewers know not to overwrite.
 * - No database writes — purely ephemeral over WebSocket.
 */
export function useNotePresence(noteId: string | undefined, displayName: string, avatarUrl?: string | null) {
  const { user } = useAuth();
  const [viewers, setViewers] = useState<NoteViewer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!noteId || !user) return;

    const channel = supabase.channel(`note:${noteId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, NoteViewer[]>;
        const list: NoteViewer[] = [];
        const seen = new Set<string>();
        for (const key of Object.keys(state)) {
          const meta = state[key]?.[0];
          if (meta && !seen.has(meta.user_id)) {
            seen.add(meta.user_id);
            list.push(meta);
          }
        }
        setViewers(list);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            name: displayName,
            avatar_url: avatarUrl ?? null,
            editing: editingRef.current,
          });
        }
      });

    return () => {
      try { channel.untrack(); } catch { /* ignore */ }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [noteId, user?.id, displayName, avatarUrl]);

  const setEditing = useCallback(async (editing: boolean) => {
    editingRef.current = editing;
    const ch = channelRef.current;
    if (!ch || !user) return;
    try {
      await ch.track({
        user_id: user.id,
        name: displayName,
        avatar_url: avatarUrl ?? null,
        editing,
      });
    } catch { /* ignore */ }
  }, [user, displayName, avatarUrl]);

  const others = viewers.filter(v => v.user_id !== user?.id);
  const otherEditor = others.find(v => v.editing);

  return { viewers, others, otherEditor, setEditing };
}