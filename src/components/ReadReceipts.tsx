import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, CheckCheck } from 'lucide-react';

interface ReadReceipt {
  user_id: string;
  user_name?: string;
}

export function useReadReceipts(groupId: string) {
  const { user } = useAuth();

  const markAsRead = async (messageId: string) => {
    if (!user) return;
    try {
      await supabase.from('message_read_receipts').upsert(
        { message_id: messageId, user_id: user.id },
        { onConflict: 'message_id,user_id' }
      );
    } catch (e) {
      // Silently fail - read receipts are non-critical
    }
  };

  return { markAsRead };
}

interface ReadReceiptIndicatorProps {
  messageId: string;
  isOwnMessage: boolean;
  groupMembers: { id: string; full_name: string }[];
}

export function ReadReceiptIndicator({ messageId, isOwnMessage, groupMembers }: ReadReceiptIndicatorProps) {
  const [readers, setReaders] = useState<ReadReceipt[]>([]);

  useEffect(() => {
    if (!isOwnMessage) return;

    const fetch = async () => {
      const { data } = await supabase
        .from('message_read_receipts')
        .select('user_id')
        .eq('message_id', messageId);
      setReaders(data || []);
    };

    fetch();

    const channel = supabase
      .channel(`receipts-${messageId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_read_receipts',
        filter: `message_id=eq.${messageId}`,
      }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messageId, isOwnMessage]);

  if (!isOwnMessage) return null;

  const readCount = readers.length;
  const readerNames = readers
    .map(r => groupMembers.find(m => m.id === r.user_id)?.full_name || 'Unknown')
    .filter(Boolean);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center ml-1">
            {readCount > 0 ? (
              <CheckCheck className="h-3 w-3 text-blue-400" />
            ) : (
              <Check className="h-3 w-3 opacity-50" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {readCount > 0
            ? `Read by ${readerNames.join(', ')}`
            : 'Sent'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
