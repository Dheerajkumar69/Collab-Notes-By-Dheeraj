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
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to fetch groups: ${error.message}`,
        variant: 'destructive',
      });
    }
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
        .insert({
          ...newGroup,
          invite_code: inviteCode,
          members: [profile.email],
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['groups', user?.id]);
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
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to fetch profile: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
};

// Stats hooks
export const useStats = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  return useQuery({
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

      return {
        groups: userGroups.length,
        notes: notesCount || 0,
      };
    },
    enabled: !!user,
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to fetch stats: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
};