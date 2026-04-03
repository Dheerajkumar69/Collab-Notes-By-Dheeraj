import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PresenceUser {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

export function useUserPresence(groupId: string) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!user || !groupId) return;

    // Set self online
    const setOnline = async () => {
      await supabase.from('user_presence').upsert(
        { group_id: groupId, user_id: user.id, is_online: true, last_seen: new Date().toISOString() },
        { onConflict: 'user_id,group_id' }
      );
    };

    const fetchPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('user_id, is_online, last_seen')
        .eq('group_id', groupId)
        .eq('is_online', true);

      const now = Date.now();
      const online = new Set<string>();
      data?.forEach(p => {
        // Consider online if last_seen within 60 seconds
        if (now - new Date(p.last_seen).getTime() < 60000) {
          online.add(p.user_id);
        }
      });
      setOnlineUsers(online);
    };

    setOnline();
    fetchPresence();

    // Heartbeat every 30s
    heartbeatRef.current = setInterval(() => {
      setOnline();
      fetchPresence();
    }, 30000);

    // Realtime subscription
    const channel = supabase
      .channel(`presence-${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        fetchPresence();
      })
      .subscribe();

    // Set offline on unload
    const handleUnload = () => {
      navigator.sendBeacon && supabase.from('user_presence')
        .update({ is_online: false })
        .eq('user_id', user.id)
        .eq('group_id', groupId);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatRef.current);
      supabase.removeChannel(channel);
      window.removeEventListener('beforeunload', handleUnload);
      // Set offline
      supabase.from('user_presence')
        .update({ is_online: false })
        .eq('user_id', user.id)
        .eq('group_id', groupId);
    };
  }, [groupId, user?.id]);

  return onlineUsers;
}

export function OnlineDot({ isOnline }: { isOnline: boolean }) {
  if (!isOnline) return null;
  return (
    <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
  );
}
