import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Reply, X, MoreVertical, Pencil, Trash2, Check } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TypingIndicator, useTypingIndicator } from './TypingIndicator';
import { MessageReactions, AddReactionButton } from './MessageReactions';
import { ChatFileUpload, ChatAttachmentPreview } from './ChatFileUpload';
import type { Json } from '@/integrations/supabase/types';

interface ChatAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface Reaction {
  emoji: string;
  user_id: string;
  user_name: string;
}

interface Message {
  id: string;
  message: string;
  user_id: string;
  user_name: string;
  created_at: string;
  is_edited: boolean;
  reply_to: string | null;
  reactions?: Reaction[];
  attachments?: ChatAttachment[];
}

interface GroupChatProps {
  groupId: string;
}

export const GroupChat = ({ groupId }: GroupChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [userName, setUserName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { startTyping, stopTyping } = useTypingIndicator(groupId);

  useEffect(() => {
    fetchMessages();
    fetchUserName();

    // Subscribe to realtime messages
    const channel = supabase
      .channel(`messages-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            // Parse reactions and attachments from JSON
            setMessages(prev => [...prev, {
              ...newMsg,
              reactions: (newMsg.reactions as unknown as Reaction[]) || [],
              attachments: (newMsg.attachments as unknown as ChatAttachment[]) || [],
            }]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages(prev =>
              prev.map(m => m.id === updatedMsg.id ? {
                ...updatedMsg,
                reactions: (updatedMsg.reactions as unknown as Reaction[]) || [],
                attachments: (updatedMsg.attachments as unknown as ChatAttachment[]) || [],
              } : m)
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopTyping();
    };
  }, [groupId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchUserName = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    setUserName(data?.full_name || 'Unknown');
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []).map(m => ({
        ...m,
        reactions: (m.reactions as unknown as Reaction[]) || [],
        attachments: (m.attachments as unknown as ChatAttachment[]) || [],
      })));
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value && userName) {
      startTyping(userName);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && pendingFiles.length === 0) || !user || sending) return;

    setSending(true);
    stopTyping();

    try {
      const { error } = await supabase.from('messages').insert({
        group_id: groupId,
        user_id: user.id,
        user_name: userName,
        message: newMessage.trim() || (pendingFiles.length > 0 ? '📎 Attachment' : ''),
        reply_to: replyingTo?.id || null,
        attachments: pendingFiles as unknown as Json,
      });

      if (error) throw error;

      // Notify other group members
      try {
        const { data: group } = await supabase
          .from('groups')
          .select('members, name')
          .eq('id', groupId)
          .single();

        if (group?.members) {
          // Get user IDs for all members except sender
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email')
            .in('email', group.members);

          const otherMembers = profiles?.filter(p => p.id !== user.id) || [];

          // Create notifications for each member
          for (const member of otherMembers) {
            await supabase.from('notifications').insert({
              user_id: member.id,
              message: `💬 ${userName} sent a message in ${group.name}`,
              link: `/group/${groupId}`,
              is_read: false,
            });
          }
        }
      } catch (notifyError) {
        // Don't fail the message send if notifications fail
        console.error('Failed to send notifications:', notifyError);
      }

      setNewMessage('');
      setReplyingTo(null);
      setPendingFiles([]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ message: editText.trim(), is_edited: true })
        .eq('id', editingMessage.id);

      if (error) throw error;
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to edit message',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
    }
  };

  const getReplyMessage = (replyId: string) => {
    return messages.find(m => m.id === replyId);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    }
    return format(date, 'MMM d, HH:mm');
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];

    msgs.forEach(msg => {
      const date = new Date(msg.created_at);
      let dateLabel: string;

      if (isToday(date)) {
        dateLabel = 'Today';
      } else if (isYesterday(date)) {
        dateLabel = 'Yesterday';
      } else {
        dateLabel = format(date, 'MMMM d, yyyy');
      }

      const existingGroup = groups.find(g => g.date === dateLabel);
      if (existingGroup) {
        existingGroup.messages.push(msg);
      } else {
        groups.push({ date: dateLabel, messages: [msg] });
      }
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-[600px] border rounded-xl bg-card overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="font-semibold">Group Chat</h3>
        <p className="text-xs text-muted-foreground">{messages.length} messages</p>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p>No messages yet</p>
            <p className="text-sm">Be the first to say something!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messageGroups.map(group => (
              <div key={group.date}>
                {/* Date Separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 text-xs bg-muted rounded-full text-muted-foreground">
                    {group.date}
                  </span>
                </div>

                {/* Messages */}
                <div className="space-y-2">
                  {group.messages.map(msg => {
                    const isOwnMessage = msg.user_id === user?.id;
                    const replyMsg = msg.reply_to ? getReplyMessage(msg.reply_to) : null;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-[75%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                          {!isOwnMessage && (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs">
                                {msg.user_name[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}

                          <div className="group relative">
                            <div
                              className={`px-3 py-2 rounded-2xl ${isOwnMessage
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md'
                                }`}
                            >
                              {/* Reply Preview */}
                              {replyMsg && (
                                <div className={`text-xs mb-1 px-2 py-1 rounded border-l-2 ${isOwnMessage
                                  ? 'bg-primary-foreground/10 border-primary-foreground/50'
                                  : 'bg-background/50 border-primary/50'
                                  }`}>
                                  <span className="font-medium">{replyMsg.user_name}</span>
                                  <p className="truncate opacity-80">{replyMsg.message}</p>
                                </div>
                              )}

                              {!isOwnMessage && (
                                <p className="text-xs font-medium text-primary mb-1">
                                  {msg.user_name}
                                </p>
                              )}

                              {/* Attachments */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <ChatAttachmentPreview
                                  attachments={msg.attachments}
                                  isOwnMessage={isOwnMessage}
                                />
                              )}

                              {editingMessage?.id === msg.id ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="h-7 text-sm"
                                    autoFocus
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleEdit}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingMessage(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                              )}

                              <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                }`}>
                                <span>{formatMessageTime(msg.created_at)}</span>
                                {msg.is_edited && <span>• edited</span>}
                              </div>

                              {/* Reactions */}
                              {msg.reactions && (
                                <div className="mt-1">
                                  <MessageReactions
                                    messageId={msg.id}
                                    reactions={msg.reactions}
                                    currentUserId={user?.id || ''}
                                    isOwnMessage={isOwnMessage}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Message Actions */}
                            <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isOwnMessage ? '-left-16' : '-right-16'
                              }`}>
                              <AddReactionButton
                                messageId={msg.id}
                                reactions={msg.reactions || []}
                                currentUserId={user?.id || ''}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isOwnMessage ? 'start' : 'end'}>
                                  <DropdownMenuItem onClick={() => {
                                    setReplyingTo(msg);
                                    inputRef.current?.focus();
                                  }}>
                                    <Reply className="h-4 w-4 mr-2" />
                                    Reply
                                  </DropdownMenuItem>
                                  {isOwnMessage && (
                                    <>
                                      <DropdownMenuItem onClick={() => {
                                        setEditingMessage(msg);
                                        setEditText(msg.message);
                                      }}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDelete(msg.id)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Typing Indicator */}
      <TypingIndicator groupId={groupId} />

      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-muted/50 border-t flex items-center gap-2">
          <Reply className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 truncate">
            <span className="text-sm font-medium">{replyingTo.user_name}</span>
            <p className="text-xs text-muted-foreground truncate">{replyingTo.message}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={sendMessage} className="p-3 border-t bg-background">
        <div className="flex gap-2 items-end">
          <ChatFileUpload
            groupId={groupId}
            onFilesSelected={(files) => setPendingFiles(prev => [...prev, ...files])}
            pendingFiles={pendingFiles}
            onRemoveFile={(index) => setPendingFiles(prev => prev.filter((_, i) => i !== index))}
            disabled={sending}
          />
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={handleInputChange}
            onBlur={stopTyping}
            className="flex-1"
            disabled={sending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={(!newMessage.trim() && pendingFiles.length === 0) || sending}
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
