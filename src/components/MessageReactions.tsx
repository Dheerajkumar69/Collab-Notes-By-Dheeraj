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

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👏', '✅', '💯'];

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

// Helper hook to handle reaction logic
const useReactionHandler = (
    messageId: string,
    reactions: Reaction[],
    currentUserId: string
) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleReaction = async (emoji: string) => {
        if (isUpdating || !currentUserId) return;

        setIsUpdating(true);
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', currentUserId)
                .single();

            const currentReactions = reactions || [];

            // Find if user has any existing reaction
            const existingUserReaction = currentReactions.find(
                (r) => r.user_id === currentUserId
            );

            let newReactions: Reaction[];

            if (existingUserReaction?.emoji === emoji) {
                // User clicked the same emoji - remove their reaction (toggle off)
                newReactions = currentReactions.filter((r) => r.user_id !== currentUserId);
            } else {
                // Remove any existing reaction from this user, then add the new one
                const filteredReactions = currentReactions.filter((r) => r.user_id !== currentUserId);
                newReactions = [
                    ...filteredReactions,
                    {
                        emoji,
                        user_id: currentUserId,
                        user_name: profile?.full_name || 'Unknown',
                    },
                ];
            }

            const { error } = await supabase
                .from('messages')
                .update({ reactions: newReactions as unknown as Json })
                .eq('id', messageId);

            if (error) throw error;
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to add reaction',
                variant: 'destructive',
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return { handleReaction, isUpdating };
};

// Shows only existing reaction badges (no add button)
export const MessageReactions = ({
    messageId,
    reactions,
    currentUserId,
    isOwnMessage,
}: MessageReactionsProps) => {
    const { handleReaction } = useReactionHandler(messageId, reactions, currentUserId);

    const getReactionCount = (emoji: string) => {
        return reactions?.filter((r) => r.emoji === emoji).length || 0;
    };

    const hasUserReacted = (emoji: string) => {
        return reactions?.some((r) => r.emoji === emoji && r.user_id === currentUserId);
    };

    const uniqueReactions = EMOJIS.filter((emoji) => getReactionCount(emoji) > 0);

    if (uniqueReactions.length === 0) return null;

    return (
        <div className="flex items-center gap-1 flex-wrap">
            {uniqueReactions.map((emoji) => (
                <Badge
                    key={emoji}
                    variant={hasUserReacted(emoji) ? 'default' : 'outline'}
                    className={`text-xs cursor-pointer transition-transform hover:scale-105 ${isOwnMessage ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : ''
                        }`}
                    onClick={() => handleReaction(emoji)}
                >
                    {emoji} {getReactionCount(emoji)}
                </Badge>
            ))}
        </div>
    );
};

// Separate add reaction button for placing outside the message bubble
interface AddReactionButtonProps {
    messageId: string;
    reactions: Reaction[];
    currentUserId: string;
}

export const AddReactionButton = ({
    messageId,
    reactions,
    currentUserId,
}: AddReactionButtonProps) => {
    const { handleReaction, isUpdating } = useReactionHandler(messageId, reactions, currentUserId);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 touch-manipulation"
                    disabled={isUpdating}
                >
                    <Smile className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" side="top" sideOffset={8}>
                <div className="flex gap-1 flex-wrap max-w-[200px]">
                    {EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReaction(emoji)}
                            className="text-2xl p-2 hover:scale-110 active:scale-95 transition-transform rounded-lg hover:bg-muted touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                            disabled={isUpdating}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};
