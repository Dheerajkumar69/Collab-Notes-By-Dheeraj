import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MoreVertical, Pin, Edit, Trash2, Smile, Archive, ArchiveRestore, Loader2, Hash } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { NoteViewDialog } from './NoteViewDialog';
import { EditRequestDialog } from './EditRequestDialog';
import { useDeleteNoteWithCleanup } from '@/hooks/useDeleteNoteWithCleanup';
import { useTelegramSync } from '@/hooks/useTelegramSync';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👏', '✅', '💯'];

interface Attachment {
  url: string;
  name: string;
  type: string;
}

interface Reaction {
  emoji: string;
  user_email: string;
  user_name: string;
}

interface NoteCardNote {
  id: string;
  title: string;
  content?: string | null;
  color?: string | null;
  labels?: string[];
  attachments?: Attachment[];
  reactions?: Reaction[];
  is_pinned?: boolean;
  is_archived?: boolean;
  telegram_file_id?: string | null;
  author_name?: string | null;
  created_by: string;
  group_id?: string;
  lecture_number?: number | null;
  topic?: string | null;
}

interface NoteCardProps {
  note: NoteCardNote;
  onUpdate: () => void;
  onEdit: () => void;
  isCreator: boolean;
}


export function NoteCard({ note, onUpdate, onEdit, isCreator }: NoteCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditRequest, setShowEditRequest] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { deleteNoteWithCleanup } = useDeleteNoteWithCleanup();
  const { archiveNote, unarchiveNote, deleteFromTelegram } = useTelegramSync();

  const canEdit = note.created_by === user?.id;

  const handleOpenNote = () => {
    if (note.group_id) {
      navigate(`/group/${note.group_id}/note/${note.id}`);
    } else {
      setShowViewDialog(true);
    }
  };

  const handleTogglePin = async () => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_pinned: !note.is_pinned })
        .eq('id', note.id);

      if (error) throw error;
      toast({ title: 'Success', description: note.is_pinned ? 'Note unpinned' : 'Note pinned' });
      onUpdate();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update note', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    // Delete from Telegram first
    await deleteFromTelegram(note.id);
    const success = await deleteNoteWithCleanup(note.id, note.attachments);
    if (success) {
      onUpdate();
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    const result = await archiveNote(note.id);
    setArchiving(false);
    if (result) {
      onUpdate();
    }
  };

  const handleUnarchive = async () => {
    setArchiving(true);
    const result = await unarchiveNote(note.id);
    setArchiving(false);
    if (result) {
      onUpdate();
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user?.id)
        .single();

      const reactions = note.reactions || [];
      const existingIndex = reactions.findIndex(
        (r) => r.emoji === emoji && r.user_email === profile?.email
      );

      let newReactions: Reaction[];
      if (existingIndex >= 0) {
        newReactions = reactions.filter((_, i) => i !== existingIndex);
      } else {
        newReactions = [
          ...reactions,
          {
            emoji,
            user_email: profile?.email || '',
            user_name: profile?.full_name || '',
          },
        ];
      }

      const { error } = await supabase
        .from('notes')
        .update({ reactions: JSON.parse(JSON.stringify(newReactions)) })
        .eq('id', note.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add reaction', variant: 'destructive' });
    }
  };

  const getReactionCount = (emoji: string) => {
    return note.reactions?.filter((r) => r.emoji === emoji).length || 0;
  };

  const hasUserReacted = (emoji: string) => {
    return note.reactions?.some((r) => r.emoji === emoji && r.user_email === user?.email);
  };

  const getBgColor = () => {
    const colors: Record<string, string> = {
      white: 'bg-white dark:bg-slate-900',
      red: 'bg-red-100 dark:bg-red-950',
      orange: 'bg-orange-100 dark:bg-orange-950',
      yellow: 'bg-yellow-100 dark:bg-yellow-950',
      green: 'bg-green-100 dark:bg-green-950',
      blue: 'bg-blue-100 dark:bg-blue-950',
      purple: 'bg-purple-100 dark:bg-purple-950',
      gray: 'bg-gray-100 dark:bg-gray-800',
    };
    return colors[note.color || 'white'] || colors.white;
  };

  const firstImage = note.attachments?.find((a) => a.type?.startsWith('image/'));

  return (
    <>
      <Card
        className={`${getBgColor()} p-4 hover:shadow-lg transition-shadow cursor-pointer group relative ${note.is_archived ? 'opacity-70' : ''}`}
        onClick={handleOpenNote}
      >
        {note.is_pinned && (
          <Pin className="absolute top-2 right-2 h-4 w-4 text-primary" />
        )}
        
        {note.is_archived && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-xs">
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        )}

        {firstImage && (
          <img
            src={firstImage.url}
            alt="Note preview"
            className="w-full h-32 object-cover rounded-lg mb-3"
          />
        )}

        {/* Lecture & Topic badges */}
        {(note.lecture_number || note.topic) && (
          <div className="flex gap-2 flex-wrap mb-2">
            {note.lecture_number && (
              <Badge variant="outline" className="text-xs gap-1 bg-primary/10 border-primary/30">
                <Hash className="h-3 w-3" />
                Lecture {note.lecture_number}
              </Badge>
            )}
            {note.topic && (
              <Badge variant="outline" className="text-xs gap-1 bg-secondary">
                <BookOpen className="h-3 w-3" />
                {note.topic}
              </Badge>
            )}
          </div>
        )}

        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{note.title}</h3>

        {note.content && !note.is_archived && (
          <div className="text-muted-foreground text-sm mb-3 line-clamp-4 overflow-hidden">
            {note.content.startsWith('<') ? (
              <div 
                className="tiptap [&_*]:!m-0 [&_*]:!p-0" 
                dangerouslySetInnerHTML={{ 
                  __html: note.content.replace(/<img[^>]*>/g, '').slice(0, 500) 
                }} 
              />
            ) : (
              <p>{note.content.slice(0, 200)}</p>
            )}
          </div>
        )}
        
        {note.is_archived && (
          <p className="text-muted-foreground text-sm mb-3 italic">
            Content stored in Telegram. Click to restore.
          </p>
        )}

        {note.labels && note.labels.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {note.labels.map((label: string) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        )}

        {note.reactions && note.reactions.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {EMOJIS.filter(emoji => getReactionCount(emoji) > 0).map(emoji => (
              <Badge
                key={emoji}
                variant={hasUserReacted(emoji) ? 'default' : 'outline'}
                className="text-xs cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  handleReaction(emoji);
                }}
              >
                {emoji} {getReactionCount(emoji)}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                {note.author_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{note.author_name}</span>
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Popover>
              <PopoverTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm">
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" onClick={e => e.stopPropagation()}>
                <div className="flex gap-2">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={e => {
                        e.stopPropagation();
                        handleReaction(emoji);
                      }}
                      className="text-2xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={handleTogglePin}>
                  <Pin className="h-4 w-4 mr-2" />
                  {note.is_pinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                
                {/* Archive/Unarchive option */}
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    {note.is_archived ? (
                      <DropdownMenuItem onClick={handleUnarchive} disabled={archiving}>
                        {archiving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ArchiveRestore className="h-4 w-4 mr-2" />
                        )}
                        Restore from Telegram
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={handleArchive} disabled={archiving}>
                        {archiving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4 mr-2" />
                        )}
                        Archive to Telegram
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {canEdit ? (
                  <>
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => setShowEditRequest(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Request Edit
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>

      <NoteViewDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        note={note}
      />

      <EditRequestDialog
        open={showEditRequest}
        onOpenChange={setShowEditRequest}
        note={note}
        onSuccess={onUpdate}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this note. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
