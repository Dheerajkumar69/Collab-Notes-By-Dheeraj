import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = 'groups' | 'notes' | 'notifications';

interface UseRealtimeSubscriptionOptions {
  table: TableName;
  queryKey: string[];
  filter?: string;
}

export const useRealtimeSubscription = ({ table, queryKey, filter }: UseRealtimeSubscriptionOptions) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channelName = `${table}-${user.id}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Invalidate queries to refetch fresh data
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, table, queryKey, filter, queryClient]);
};

// Hook for groups realtime
export const useRealtimeGroups = () => {
  const { user } = useAuth();
  useRealtimeSubscription({
    table: 'groups',
    queryKey: ['groups', user?.id || ''],
  });
};

// Hook for notes realtime with group filter
export const useRealtimeNotes = (groupId?: string) => {
  useRealtimeSubscription({
    table: 'notes',
    queryKey: ['notes', groupId || ''],
    filter: groupId ? `group_id=eq.${groupId}` : undefined,
  });
};

// Hook for notifications realtime
export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  useRealtimeSubscription({
    table: 'notifications',
    queryKey: ['notifications', user?.id || ''],
    filter: user ? `user_id=eq.${user.id}` : undefined,
  });
};
