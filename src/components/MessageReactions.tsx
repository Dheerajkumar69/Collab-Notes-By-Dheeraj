import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Smile } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👏', '😮', '😢'];

interface Reaction {
  emoji: string;
  user_id: string;
  user_name: string;
}

interface MessageReactionsProps {
  messageId: string;
  reactions: Reaction[];
  currentUserId: string;
  isOwnMessage: boolean;
}

export const MessageReactions = ({
  messageId,
  reactions = [],
  currentUserId,
  isOwnMessage,
}: MessageReactionsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleReaction = async (emoji: string, userName: string) => {
    try {
      const existingIndex = reactions.findIndex(
        (r) => r.emoji === emoji && r.user_id === currentUserId
      );

      let newReactions: { emoji: string; user_id: string; user_name: string }[];
      if (existingIndex >= 0) {
        // Remove reaction
        newReactions = reactions.filter((_, i) => i !== existingIndex);
      } else {
        // Add reaction
        newReactions = [
          ...reactions,
          { emoji, user_id: currentUserId, user_name: userName },
        ];
      }

      const { error } = await supabase
        .from('messages')
        .update({ reactions: newReactions as Json })
        .eq('id', messageId);

      if (error) throw error;
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add reaction',
        variant: 'destructive',
      });
    }
  };

  const getReactionCount = (emoji: string) => {
    return reactions.filter((r) => r.emoji === emoji).length;
  };

  const hasUserReacted = (emoji: string) => {
    return reactions.some((r) => r.emoji === emoji && r.user_id === currentUserId);
  };

  const uniqueEmojis = [...new Set(reactions.map((r) => r.emoji))];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Display existing reactions */}
      {uniqueEmojis.map((emoji) => (
        <Badge
          key={emoji}
          variant={hasUserReacted(emoji) ? 'default' : 'outline'}
          className={`text-xs cursor-pointer px-1.5 py-0.5 ${
            isOwnMessage
              ? hasUserReacted(emoji)
                ? 'bg-white/30 hover:bg-white/40 border-0'
                : 'bg-white/10 hover:bg-white/20 border-white/30'
              : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleReaction(emoji, '');
          }}
        >
          {emoji} {getReactionCount(emoji)}
        </Badge>
      ))}

      {/* Add reaction button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ${
              isOwnMessage ? 'text-white/70 hover:text-white hover:bg-white/20' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <Smile className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji, '')}
                className="text-xl hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
