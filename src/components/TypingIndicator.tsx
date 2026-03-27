import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TypingUser {
  user_id: string;
  user_name: string;
}

interface TypingIndicatorProps {
  groupId: string;
}

export const useTypingIndicator = (groupId: string) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef<number>(0);

  useEffect(() => {
    // Subscribe to typing indicators
    const channel = supabase
      .channel(`typing-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `group_id=eq.${groupId}`,
        },
        async () => {
          // Refetch typing indicators on any change
          const { data } = await supabase
            .from('typing_indicators')
            .select('user_id, user_name')
            .eq('group_id', groupId)
            .neq('user_id', user?.id || '');

          setTypingUsers(data || []);
        }
      )
      .subscribe();

    // Initial fetch
    const fetchTyping = async () => {
      const { data } = await supabase
        .from('typing_indicators')
        .select('user_id, user_name')
        .eq('group_id', groupId)
        .neq('user_id', user?.id || '');

      setTypingUsers(data || []);
    };

    fetchTyping();

    // Cleanup interval - remove stale typing indicators
    const cleanupInterval = setInterval(async () => {
      await supabase.rpc('cleanup_typing_indicators');
      fetchTyping();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(cleanupInterval);
    };
  }, [groupId, user?.id]);

  const startTyping = useCallback(async (userName: string) => {
    if (!user) return;
    
    const now = Date.now();
    // Throttle: only update every 2 seconds
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;

    // Upsert typing indicator
    await supabase
      .from('typing_indicators')
      .upsert(
        {
          group_id: groupId,
          user_id: user.id,
          user_name: userName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,group_id', ignoreDuplicates: false }
      );

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to remove typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('user_id', user.id)
        .eq('group_id', groupId);
    }, 3000);
  }, [groupId, user]);

  const stopTyping = useCallback(async () => {
    if (!user) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    await supabase
      .from('typing_indicators')
      .delete()
      .eq('user_id', user.id)
      .eq('group_id', groupId);
  }, [groupId, user]);

  return { typingUsers, startTyping, stopTyping };
};

export const TypingIndicator = ({ groupId }: TypingIndicatorProps) => {
  const { typingUsers } = useTypingIndicator(groupId);

  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].user_name} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].user_name} and ${typingUsers[1].user_name} are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <div className="px-4 py-1 text-xs text-muted-foreground flex items-center gap-2">
      <div className="flex gap-1">
        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
};
