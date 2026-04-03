import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { FileText, MessageSquare, UserPlus, Edit, Trash2, Pin, FolderPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  user_name: string;
  action: string;
  target_type: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface ActivityFeedProps {
  groupId: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'created_note': return <FileText className="h-4 w-4 text-green-500" />;
    case 'updated_note': return <Edit className="h-4 w-4 text-blue-500" />;
    case 'deleted_note': return <Trash2 className="h-4 w-4 text-red-500" />;
    case 'pinned_note': return <Pin className="h-4 w-4 text-yellow-500" />;
    case 'sent_message': return <MessageSquare className="h-4 w-4 text-purple-500" />;
    case 'joined_group': return <UserPlus className="h-4 w-4 text-indigo-500" />;
    case 'created_folder': return <FolderPlus className="h-4 w-4 text-orange-500" />;
    default: return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

const getActionText = (action: string, metadata: Record<string, any>) => {
  const target = metadata?.title || metadata?.name || '';
  switch (action) {
    case 'created_note': return `created note "${target}"`;
    case 'updated_note': return `updated note "${target}"`;
    case 'deleted_note': return `deleted note "${target}"`;
    case 'pinned_note': return `pinned note "${target}"`;
    case 'sent_message': return 'sent a message';
    case 'joined_group': return 'joined the group';
    case 'created_folder': return `created folder "${target}"`;
    default: return action.replace(/_/g, ' ');
  }
};

export function ActivityFeed({ groupId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(50);

      setActivities((data as Activity[]) || []);
      setLoading(false);
    };

    fetchActivities();

    const channel = supabase
      .channel(`activity-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `group_id=eq.${groupId}`,
      }, () => fetchActivities())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">Loading activity...</div>;
  }

  if (activities.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        No activity yet. Start collaborating!
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-1 p-2">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="mt-0.5">{getActionIcon(activity.action)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{activity.user_name}</span>{' '}
                <span className="text-muted-foreground">
                  {getActionText(activity.action, activity.metadata || {})}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Helper to log activity
export async function logActivity(
  groupId: string,
  userId: string,
  userName: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, any>
) {
  try {
    await supabase.from('activity_log').insert({
      group_id: groupId,
      user_id: userId,
      user_name: userName,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      metadata: metadata || {},
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}
