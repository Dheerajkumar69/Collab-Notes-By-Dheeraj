import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor, RichTextViewer } from '@/components/RichTextEditor';
import { NoteVersionHistory } from '@/components/NoteVersionHistory';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Calendar, 
  Tag, 
  Plus, 
  ChevronRight, 
  Lock, 
  Star,
  MoreHorizontal,
  Trash2,
  Pin,
  Download,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Hash,
  BookOpen,
  Save,
  X,
  Pencil
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { useDeleteNoteWithCleanup } from '@/hooks/useDeleteNoteWithCleanup';

interface Attachment {
  url: string;
  name: string;
  type: string;
}

interface Note {
  id: string;
  title: string;
  content?: string | null;
  color?: string | null;
  labels?: string[];
  attachments?: Attachment[];
  is_pinned?: boolean;
  author_name?: string | null;
  created_by: string;
  group_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  lecture_number?: number | null;
  topic?: string | null;
}

interface Group {
  id: string;
  name: string;
  color?: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
}

export default function NotePage() {
  const { groupId, noteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [note, setNote] = useState<Note | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Editable states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLectureNumber, setEditLectureNumber] = useState<string>('');
  const [editTopic, setEditTopic] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { deleteNoteWithCleanup } = useDeleteNoteWithCleanup();
  
  const canEdit = note?.created_by === user?.id;

  const handleSaveContent = useCallback(async () => {
    if (!note) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ content: editContent, updated_at: new Date().toISOString() })
        .eq('id', note.id);

      if (error) throw error;
      setNote(prev => prev ? { ...prev, content: editContent } : null);
      setIsEditingContent(false);
      setHasUnsavedChanges(false);
      toast({ title: 'Saved', description: 'Content updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save content', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [note, editContent]);

  const handleContentChange = useCallback((newContent: string) => {
    setEditContent(newContent);
    setHasUnsavedChanges(true);
  }, []);

  useEffect(() => {
    if (groupId && noteId) {
      fetchData();
    }
  }, [groupId, noteId]);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditingContent && hasUnsavedChanges) {
          handleSaveContent();
        }
      }
      // Escape to cancel editing
      if (e.key === 'Escape' && isEditingContent) {
        setEditContent(note?.content || '');
        setIsEditingContent(false);
        setHasUnsavedChanges(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingContent, hasUnsavedChanges, handleSaveContent, note]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchData = async () => {
    try {
      const [noteResult, groupResult] = await Promise.all([
        supabase.from('notes').select('*').eq('id', noteId).single(),
        supabase.from('groups').select('id, name, color').eq('id', groupId).single(),
      ]);

      if (noteResult.error) throw noteResult.error;
      if (groupResult.error) throw groupResult.error;

      const rawNote = noteResult.data;
      const parsedAttachments: Attachment[] = [];
      if (Array.isArray(rawNote.attachments)) {
        for (const att of rawNote.attachments) {
          if (att && typeof att === 'object' && !Array.isArray(att)) {
            const obj = att as Record<string, unknown>;
            if (typeof obj.url === 'string' && typeof obj.name === 'string' && typeof obj.type === 'string') {
              parsedAttachments.push({ url: obj.url, name: obj.name, type: obj.type });
            }
          }
        }
      }
      const noteData: Note = {
        ...rawNote,
        attachments: parsedAttachments,
        labels: rawNote.labels || [],
      };
      
      setNote(noteData);
      setGroup(groupResult.data);
      setEditTitle(noteData.title);
      setEditContent(noteData.content || '');
      setEditLectureNumber(noteData.lecture_number?.toString() || '');
      setEditTopic(noteData.topic || '');

      if (noteData.created_by) {
        const { data: authorData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', noteData.created_by)
          .single();
        setAuthor(authorData);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load note',
        variant: 'destructive',
      });
      navigate(`/group/${groupId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!note || !editTitle.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ title: editTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', note.id);

      if (error) throw error;
      setNote({ ...note, title: editTitle.trim() });
      setIsEditingTitle(false);
      toast({ title: 'Saved', description: 'Title updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save title', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };


  const handleSaveProperty = async (field: 'lecture_number' | 'topic', value: string | number | null) => {
    if (!note) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', note.id);

      if (error) throw error;
      setNote({ ...note, [field]: value });
      toast({ title: 'Saved', description: 'Property updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save property', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLabel = async () => {
    if (!note || !newLabel.trim()) return;
    const updatedLabels = [...(note.labels || []), newLabel.trim()];
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ labels: updatedLabels, updated_at: new Date().toISOString() })
        .eq('id', note.id);

      if (error) throw error;
      setNote({ ...note, labels: updatedLabels });
      setNewLabel('');
      setShowAddLabel(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add label', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLabel = async (labelToRemove: string) => {
    if (!note) return;
    const updatedLabels = note.labels?.filter(l => l !== labelToRemove) || [];
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ labels: updatedLabels, updated_at: new Date().toISOString() })
        .eq('id', note.id);

      if (error) throw error;
      setNote({ ...note, labels: updatedLabels });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove label', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async () => {
    if (!note) return;
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_pinned: !note.is_pinned })
        .eq('id', note.id);

      if (error) throw error;
      setNote({ ...note, is_pinned: !note.is_pinned });
      toast({ title: 'Success', description: note.is_pinned ? 'Note unpinned' : 'Note pinned' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update note', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    const success = await deleteNoteWithCleanup(note.id, note.attachments);
    if (success) {
      navigate(`/group/${groupId}`);
    }
  };

  const images = note?.attachments?.filter((a) => a.type?.startsWith('image/')) || [];
  const files = note?.attachments?.filter((a) => !a.type?.startsWith('image/')) || [];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!note || !group) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground">Note not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <Link 
                to={`/group/${group.id}`}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span>{group.name}</span>
              </Link>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-medium truncate max-w-[200px]">
                {note.title}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Unsaved changes indicator */}
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-500 font-medium hidden sm:block">
                  Unsaved changes
                </span>
              )}

              {note.updated_at && !hasUnsavedChanges && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Edited {format(new Date(note.updated_at), 'MMM d, yyyy')}
                </span>
              )}
              
              {note.is_pinned && (
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
              )}

              {/* Save button when editing */}
              {isEditingContent && (
                <Button 
                  size="sm" 
                  onClick={handleSaveContent} 
                  disabled={saving || !hasUnsavedChanges}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Save</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && !isEditingContent && (
                    <DropdownMenuItem onClick={() => {
                      setEditContent(note.content || '');
                      setIsEditingContent(true);
                    }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Content
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleTogglePin}>
                    <Pin className="h-4 w-4 mr-2" />
                    {note.is_pinned ? 'Unpin' : 'Pin'} Note
                  </DropdownMenuItem>
                  {canEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Note
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Editable Title */}
          <div className="mb-8">
            {isEditingTitle && canEdit ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={titleInputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-4xl font-bold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
                  placeholder="Untitled"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setEditTitle(note.title);
                      setIsEditingTitle(false);
                    }
                  }}
                />
                <Button size="sm" onClick={handleSaveTitle} disabled={saving}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    setEditTitle(note.title);
                    setIsEditingTitle(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h1 
                className={`text-4xl font-bold ${canEdit ? 'cursor-text hover:bg-muted/50 rounded px-2 -mx-2 py-1 transition-colors' : ''}`}
                onClick={() => canEdit && setIsEditingTitle(true)}
              >
                {note.title}
              </h1>
            )}
          </div>

          {/* Properties */}
          <div className="space-y-3 mb-8">
            {/* Created Date */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground w-32">
                <Clock className="h-4 w-4" />
                <span>Created</span>
              </div>
              <span className="text-foreground">
                {note.created_at && format(new Date(note.created_at), 'MMMM d, yyyy h:mm a')}
              </span>
            </div>

            {/* Lecture Number */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground w-32">
                <Hash className="h-4 w-4" />
                <span>Lecture #</span>
              </div>
              {canEdit ? (
                <Input
                  type="number"
                  value={editLectureNumber}
                  onChange={(e) => setEditLectureNumber(e.target.value)}
                  onBlur={() => handleSaveProperty('lecture_number', editLectureNumber ? parseInt(editLectureNumber) : null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveProperty('lecture_number', editLectureNumber ? parseInt(editLectureNumber) : null);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 h-8 text-sm"
                  placeholder="—"
                />
              ) : (
                <span className="text-foreground">
                  {note.lecture_number || '—'}
                </span>
              )}
            </div>

            {/* Topic */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground w-32">
                <BookOpen className="h-4 w-4" />
                <span>Topic</span>
              </div>
              {canEdit ? (
                <Input
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
                  onBlur={() => handleSaveProperty('topic', editTopic || null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveProperty('topic', editTopic || null);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="flex-1 max-w-xs h-8 text-sm"
                  placeholder="Add topic..."
                />
              ) : (
                <span className="text-foreground">
                  {note.topic || '—'}
                </span>
              )}
            </div>

            {/* Tags/Labels */}
            <div className="flex items-start gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground w-32 pt-1">
                <Tag className="h-4 w-4" />
                <span>Tags</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {note.labels?.map((label) => (
                  <Badge 
                    key={label} 
                    variant="secondary"
                    className={`${canEdit ? 'pr-1' : ''}`}
                  >
                    {label}
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveLabel(label)}
                        className="ml-1 hover:bg-muted rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {canEdit && (
                  showAddLabel ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label"
                        className="w-24 h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddLabel();
                          if (e.key === 'Escape') {
                            setNewLabel('');
                            setShowAddLabel(false);
                          }
                        }}
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddLabel}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setShowAddLabel(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add tag
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Author */}
          <div className="mb-6">
            <div className="text-sm text-muted-foreground mb-2">Author</div>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                {author?.avatar_url && <AvatarImage src={author.avatar_url} />}
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm">
                  {author?.full_name?.charAt(0) || note.author_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{author?.full_name || note.author_name}</span>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="mb-8">
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={images[currentImageIndex].url}
                  alt="Note attachment"
                  className="w-full max-h-[500px] object-contain bg-muted"
                />
                {images.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 text-foreground px-3 py-1 rounded-full text-sm">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Version History */}
          {canEdit && (
            <div className="flex justify-end mb-4">
              <NoteVersionHistory
                noteId={note.id}
                currentTitle={note.title}
                currentContent={note.content || ''}
                onRestore={async (title, content) => {
                  try {
                    const { error } = await supabase
                      .from('notes')
                      .update({ title, content, updated_at: new Date().toISOString() })
                      .eq('id', note.id);
                    if (error) throw error;
                    setNote({ ...note, title, content });
                    setEditTitle(title);
                    setEditContent(content);
                    setHasUnsavedChanges(false);
                  } catch (err) {
                    toast({ title: 'Error', description: 'Failed to restore version', variant: 'destructive' });
                  }
                }}
              />
            </div>
          )}

          {/* Content Area */}
          <div className="min-h-[200px]">
            {isEditingContent && canEdit ? (
              <div className="space-y-3">
                <RichTextEditor
                  content={editContent}
                  onChange={handleContentChange}
                  placeholder="Write your notes here..."
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleSaveContent} disabled={saving || !hasUnsavedChanges}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setEditContent(note.content || '');
                      setIsEditingContent(false);
                      setHasUnsavedChanges(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <span className="text-xs text-muted-foreground ml-2">
                    Ctrl+S to save · Esc to cancel
                  </span>
                </div>
              </div>
            ) : (
              <div 
                className={`relative group ${canEdit ? 'cursor-text hover:bg-muted/30 rounded-lg p-4 -m-4 transition-colors' : ''}`}
                onClick={() => {
                  if (canEdit) {
                    setEditContent(note.content || '');
                    setIsEditingContent(true);
                  }
                }}
              >
                {canEdit && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                )}
                {note.content ? (
                  <RichTextViewer content={note.content} />
                ) : (
                  <p className="text-muted-foreground italic">
                    {canEdit ? 'Click to add content...' : 'No content yet.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* File Attachments */}
          {files.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-3">Attachments</h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
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
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
