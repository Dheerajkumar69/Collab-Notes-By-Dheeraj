import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Pin, Loader2 } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

interface QuickNoteInputProps {
  groupId: string;
  onSuccess: () => void;
}

export function QuickNoteInput({ groupId, onSuccess }: QuickNoteInputProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    setTitle('');
    setContent('');
    setIsPinned(false);
  }, []);

  const handleSave = useCallback(async () => {
    // Strip HTML tags to check if content is actually empty
    const strippedContent = content.replace(/<[^>]*>/g, '').trim();
    if (!strippedContent && !title.trim()) {
      handleClose();
      return;
    }

    try {
      setSaving(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      const noteData = {
        title: title.trim() || 'Untitled',
        content: content,
        group_id: groupId,
        author_name: profile?.full_name || 'User',
        created_by: user?.id,
        is_pinned: isPinned,
        color: 'white',
      };

      const { error } = await supabase.from('notes').insert([noteData]);
      if (error) throw error;

      toast({ title: 'Note saved' });
      handleClose();
      onSuccess();
    } catch (error) {
      console.error('Error saving note:', error);
      toast({
        title: 'Error',
        description: 'Failed to save note',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [content, title, groupId, user, isPinned, handleClose, onSuccess]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const strippedContent = content.replace(/<[^>]*>/g, '').trim();
        if (title.trim() || strippedContent) {
          handleSave();
        } else {
          handleClose();
        }
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, title, content, handleSave, handleClose]);

  if (!isExpanded) {
    return (
      <div className="mb-6 cursor-text" onClick={() => setIsExpanded(true)}>
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:shadow-md transition-shadow">
          <span className="text-muted-foreground flex-1">Take a note...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mb-6 rounded-lg border bg-card shadow-lg overflow-hidden"
    >
      {/* Title Row */}
      <div className="flex items-center border-b">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="border-0 text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsPinned(!isPinned)}
          className={isPinned ? 'text-primary' : 'text-muted-foreground'}
        >
          <Pin className="h-4 w-4" />
        </Button>
      </div>

      {/* Rich Text Content Area */}
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Take a note..."
        className="border-0 rounded-none"
      />

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 p-2 border-t bg-muted/30">
        <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
