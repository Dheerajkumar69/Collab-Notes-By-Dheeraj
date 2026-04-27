import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RichTextEditor } from '@/components/RichTextEditor';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Upload, X, Loader2, LayoutTemplate } from 'lucide-react';
import { useTelegramSync } from '@/hooks/useTelegramSync';
import { NoteTemplates } from '@/components/NoteTemplates';
import type { Attachment, Note } from '@/types';
import {
  validateUploadFile,
  MAX_NOTE_TITLE_LEN,
  MAX_NOTE_TOPIC_LEN,
  MAX_NOTE_LABEL_LEN,
  MAX_NOTE_LABELS,
} from '@/lib/sanitize';

interface CreateNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onSuccess: () => void;
  editingNote?: Note | null;
}

const COLORS = [
  { name: 'White', value: 'white' },
  { name: 'Red', value: 'red' },
  { name: 'Orange', value: 'orange' },
  { name: 'Yellow', value: 'yellow' },
  { name: 'Green', value: 'green' },
  { name: 'Blue', value: 'blue' },
  { name: 'Purple', value: 'purple' },
  { name: 'Gray', value: 'gray' },
];

export function CreateNoteDialog({
  open,
  onOpenChange,
  groupId,
  onSuccess,
  editingNote,
}: CreateNoteDialogProps) {
  const { user } = useAuth();
  const { syncNoteToTelegram } = useTelegramSync();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [color, setColor] = useState('white');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lectureNumber, setLectureNumber] = useState<number | ''>('');
  const [topic, setTopic] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    // Only sync state when the dialog opens — avoids flicker on close
    if (!open) return;
    if (editingNote) {
      setTitle(editingNote.title || '');
      setContent(editingNote.content || '');
      setLabels(editingNote.labels || []);
      setColor(editingNote.color || 'white');
      setLectureNumber(((editingNote as unknown) as { lecture_number?: number | null }).lecture_number ?? '');
      setTopic(((editingNote as unknown) as { topic?: string | null }).topic || '');
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingNote?.id]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setLabels([]);
    setNewLabel('');
    setColor('white');
    setFiles([]);
    setLectureNumber('');
    setTopic('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    const accepted: File[] = [];
    for (const f of incoming) {
      const v = validateUploadFile(f);
      if (!v.ok) {
        toast({ title: 'File rejected', description: v.reason, variant: 'destructive' });
        continue;
      }
      accepted.push(f);
    }
    setFiles(accepted);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addLabel = () => {
    const trimmed = newLabel.trim().slice(0, MAX_NOTE_LABEL_LEN);
    if (!trimmed) return;
    if (labels.length >= MAX_NOTE_LABELS) {
      toast({ title: 'Too many labels', description: `Max ${MAX_NOTE_LABELS} labels per note`, variant: 'destructive' });
      return;
    }
    if (labels.some(l => l.toLowerCase() === trimmed.toLowerCase())) {
      setNewLabel('');
      return;
    }
    setLabels([...labels, trimmed]);
    setNewLabel('');
  };

  const removeLabel = (label: string) => {
    setLabels(labels.filter(l => l !== label));
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast({
        title: 'Error',
        description: 'Please enter a title',
        variant: 'destructive',
      });
      return;
    }
    if (trimmedTitle.length > MAX_NOTE_TITLE_LEN) {
      toast({ title: 'Title too long', description: `Max ${MAX_NOTE_TITLE_LEN} characters`, variant: 'destructive' });
      return;
    }
    if (topic.trim().length > MAX_NOTE_TOPIC_LEN) {
      toast({ title: 'Topic too long', description: `Max ${MAX_NOTE_TOPIC_LEN} characters`, variant: 'destructive' });
      return;
    }
    if (!user?.id) {
      toast({ title: 'Not signed in', description: 'Please sign in again', variant: 'destructive' });
      return;
    }

    // Track newly uploaded paths so we can roll them back on DB failure
    const newlyUploadedPaths: string[] = [];
    try {
      setUploading(true);
      let attachments: Array<Attachment & { path?: string; size?: number }> =
        ((editingNote?.attachments as Attachment[] | undefined) || []).map(a => ({ ...a }));
      let ocrAppendText = '';

      // Upload files
      if (files.length > 0) {
        const uploadPromises = files.map(async file => {
          const v = validateUploadFile(file);
          if (!v.ok) throw new Error(v.reason);
          const rawExt = (file.name.split('.').pop() || 'bin').toLowerCase();
          const safeExt = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
          const fileName = `${crypto.randomUUID()}.${safeExt}`;
          // Path is keyed by GROUP id so RLS policies match group membership
          const filePath = `${groupId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('note-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;
          newlyUploadedPaths.push(filePath);

          const { data: signedUrlData } = await supabase.storage
            .from('note-attachments')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);

          return {
            url: signedUrlData?.signedUrl || '',
            path: filePath,
            name: file.name,
            type: file.type,
            size: file.size,
          };
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        attachments = [...attachments, ...uploadedFiles];

        // OCR for images using edge function — parallel + accumulate locally.
        // (state setters are async, so we cannot rely on `content` being updated
        // before we build noteData below — we must use a local string.)
        setProcessing(true);
        const imageFiles = uploadedFiles.filter(f => f.type.startsWith('image/'));
        const ocrResults = await Promise.allSettled(
          imageFiles.map(f =>
            supabase.functions.invoke('ocr-extract', {
              body: { storagePath: f.path },
            })
          )
        );
        for (const r of ocrResults) {
          if (r.status === 'fulfilled') {
            const txt = (r.value as { data?: { extractedText?: string } })?.data?.extractedText;
            if (txt && typeof txt === 'string') ocrAppendText += '\n\n' + txt;
          } else {
            console.error('OCR error:', r.reason);
          }
        }
      }

      const finalContent = ocrAppendText ? content + ocrAppendText : content;
      if (ocrAppendText) setContent(finalContent);

      // Get user profile for author name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const noteData = {
        title: trimmedTitle,
        content: finalContent,
        group_id: groupId,
        labels,
        color,
        attachments: attachments as never,
        author_name: profile?.full_name || 'User',
        created_by: user.id,
        lecture_number:
          lectureNumber === '' || Number.isNaN(lectureNumber as number)
            ? null
            : (lectureNumber as number),
        topic: topic.trim() || null,
      };

      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update(noteData)
          .eq('id', editingNote.id);

        if (error) throw error;

        // Sync to Telegram in background
        syncNoteToTelegram({ ...noteData, id: editingNote.id } as any);

        toast({
          title: 'Success',
          description: 'Note updated successfully',
        });
      } else {
        const { data: insertedNote, error } = await supabase
          .from('notes')
          .insert([noteData])
          .select()
          .single();

        if (error) throw error;

        // Sync to Telegram in background
        if (insertedNote) {
          syncNoteToTelegram(insertedNote as any);
        }

        toast({
          title: 'Success',
          description: 'Note created successfully',
        });
      }

      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error saving note:', error);
      // Roll back any newly uploaded files so we don't leak orphans
      if (newlyUploadedPaths.length > 0) {
        try {
          await supabase.storage.from('note-attachments').remove(newlyUploadedPaths);
        } catch (cleanupErr) {
          console.error('Failed to clean up uploaded files:', cleanupErr);
        }
      }
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save note',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{editingNote ? 'Edit Note' : 'Create Note'}</DialogTitle>
            {!editingNote && (
              <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5" />
                Templates
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lecture & Topic Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Lecture #</Label>
              <Input
                type="number"
                min={1}
                value={lectureNumber}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '') return setLectureNumber('');
                  const parsed = parseInt(v, 10);
                  if (Number.isNaN(parsed) || parsed < 1) return;
                  setLectureNumber(parsed);
                }}
                placeholder="e.g. 1, 2, 3..."
              />
            </div>
            <div>
              <Label>Topic</Label>
              <Input
                value={topic}
                maxLength={MAX_NOTE_TOPIC_LEN}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Introduction, Arrays..."
              />
            </div>
          </div>

          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              maxLength={MAX_NOTE_TITLE_LEN}
              onChange={e => setTitle(e.target.value)}
              placeholder="Note title"
            />
          </div>

          <div>
            <Label>Content</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write your note..."
            />
          </div>

          <div>
            <Label>Attachments</Label>
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-4 hover:border-primary transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Upload files (images will be OCR processed)
                </span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Labels</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLabel();
                  }
                }}
                maxLength={MAX_NOTE_LABEL_LEN}
                placeholder="Add label"
              />
              <Button onClick={addLabel} variant="outline">
                Add
              </Button>
            </div>
            {labels.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">
                {labels.map(label => (
                  <Badge key={label} variant="secondary" className="gap-1">
                    {label}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeLabel(label)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  aria-label={`Color ${c.name}`}
                  aria-pressed={color === c.value}
                  className={`w-10 h-10 rounded-lg border-2 ${
                    color === c.value
                      ? 'border-primary'
                      : 'border-transparent hover:border-muted-foreground'
                  }`}
                  style={{
                    backgroundColor:
                      c.value === 'white'
                        ? '#fff'
                        : c.value === 'gray'
                        ? '#6b7280'
                        : c.value,
                  }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading || processing}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {(uploading || processing) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {processing
                ? 'Processing...'
                : uploading
                ? 'Uploading...'
                : editingNote
                ? 'Update'
                : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <NoteTemplates
      open={showTemplates}
      onOpenChange={setShowTemplates}
      onSelect={(templateContent, templateTitle) => {
        setContent(templateContent);
        if (!title) setTitle(templateTitle);
      }}
    />
    </>
  );
}
