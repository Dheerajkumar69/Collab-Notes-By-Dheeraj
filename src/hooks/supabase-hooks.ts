import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Types
export type Group = Tables<'groups'>;
export type Note = Tables<'notes'>;
export type Profile = Tables<'profiles'>;
export type Notification = Tables<'notifications'>;

// Group hooks
export const useGroups = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  return useQuery({
    queryKey: ['groups', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newGroup: Partial<Group>) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from('groups')
        .insert([{
          name: newGroup.name || '',
          description: newGroup.description,
          color: newGroup.color,
          background_image_url: newGroup.background_image_url,
          members: [profile.email],
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      const { error: codeError } = await supabase
        .from('group_invite_codes')
        .insert({ group_id: data.id, invite_code: inviteCode });
      if (codeError) throw codeError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', user?.id] });
      toast({
        title: 'Success',
        description: 'Group created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create group: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
};

// Profile hooks
export const useProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

// Notifications hooks
export const useNotifications = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });
};

export const useDismissNotification = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });
};

// Stats hooks
export interface Stats {
  groups: number;
  notes: number;
  thisWeek: number;
}

export const useStats = () => {
  const { user } = useAuth();

  return useQuery<Stats>({
    queryKey: ['stats', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, members, created_by');

      if (groupsError) throw groupsError;

      const userGroups = groupsData?.filter(
        g => g.created_by === user.id || g.members?.includes(profile.email)
      ) || [];

      const groupIds = userGroups.map(g => g.id);

      const { count: notesCount, error: notesError } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .in('group_id', groupIds);

      if (notesError) throw notesError;

      // Get notes from this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { count: thisWeekCount, error: thisWeekError } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .in('group_id', groupIds)
        .gte('created_at', oneWeekAgo.toISOString());

      if (thisWeekError) throw thisWeekError;

      return {
        groups: userGroups.length,
        notes: notesCount || 0,
        thisWeek: thisWeekCount || 0,
      };
    },
    enabled: !!user,
  });
};