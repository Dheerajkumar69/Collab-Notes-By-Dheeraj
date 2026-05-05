import { useState, useEffect, useRef } from 'react';
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
import { Upload, X, Loader2, LayoutTemplate, CheckCircle2, AlertCircle, ScanText, FileText, Ban, ChevronDown, ChevronRight } from 'lucide-react';
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
import {
  preprocessImage,
  splitPdfToImages,
  mapWithConcurrency,
  withTimeout,
  LOW_RES_THRESHOLD,
} from '@/lib/ocrPreprocess';

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
  type FileStatus = 'pending' | 'uploading' | 'ocr' | 'done' | 'skipped' | 'error' | 'cancelled';
  const [fileStatuses, setFileStatuses] = useState<
    Record<string, { status: FileStatus; message?: string; pageProgress?: { done: number; total: number } }>
  >({});
  // Extracted OCR text per file, for the collapsible preview
  const [fileOcrText, setFileOcrText] = useState<Record<string, string>>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Record<string, boolean>>({});
  // AbortControllers keyed by `${name}:${size}` so users can cancel an in-flight OCR call
  const ocrAbortersRef = useRef<Record<string, AbortController>>({});
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
    setFileStatuses({});
    setFileOcrText({});
    setExpandedPreviews({});
    // Abort any in-flight OCR requests when the form is reset
    Object.values(ocrAbortersRef.current).forEach(c => {
      try { c.abort(); } catch { /* ignore */ }
    });
    ocrAbortersRef.current = {};
    setLectureNumber('');
    setTopic('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    const accepted: File[] = [];
    for (const raw of incoming) {
      const v = validateUploadFile(raw);
      if (!v.ok) {
        toast({ title: 'File rejected', description: v.reason, variant: 'destructive' });
        continue;
      }
      // Phase 1: pre-process images (HEIC -> JPEG, EXIF auto-rotate, downscale,
      // strip metadata). Non-images and PDFs pass through unchanged.
      let processed = raw;
      let lowRes = false;
      if (raw.type.startsWith('image/') || /\.(heic|heif)$/i.test(raw.name)) {
        try {
          const r = await preprocessImage(raw);
          processed = r.file;
          lowRes = !!r.lowRes;
        } catch (err) {
          console.warn('preprocessImage failed:', err);
        }
      }
      if (lowRes) {
        toast({
          title: 'Low-resolution image',
          description: `${raw.name} is below ${LOW_RES_THRESHOLD}px — text may be hard to read.`,
        });
      }
      accepted.push(processed);
    }
    setFiles(accepted);
    setFileStatuses(
      Object.fromEntries(accepted.map(f => [`${f.name}:${f.size}`, { status: 'pending' as FileStatus }]))
    );
    setFileOcrText({});
    setExpandedPreviews({});
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const removed = files[index];
    setFiles(files.filter((_, i) => i !== index));
    if (removed) {
      const key = `${removed.name}:${removed.size}`;
      const ctl = ocrAbortersRef.current[key];
      if (ctl) {
        try { ctl.abort(); } catch { /* ignore */ }
        delete ocrAbortersRef.current[key];
      }
      setFileStatuses(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setFileOcrText(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setExpandedPreviews(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const cancelOcr = (file: File) => {
    const key = `${file.name}:${file.size}`;
    const ctl = ocrAbortersRef.current[key];
    if (ctl) {
      try { ctl.abort(); } catch { /* ignore */ }
      delete ocrAbortersRef.current[key];
    }
    setFileStatus(file, 'cancelled', 'Transcription cancelled');
  };

  const setFileStatus = (
    file: File,
    status: FileStatus,
    message?: string,
    pageProgress?: { done: number; total: number },
  ) => {
    setFileStatuses(prev => ({
      ...prev,
      [`${file.name}:${file.size}`]: { status, message, pageProgress },
    }));
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
          setFileStatus(file, 'uploading');
          const rawExt = (file.name.split('.').pop() || 'bin').toLowerCase();
          const safeExt = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
          const fileName = `${crypto.randomUUID()}.${safeExt}`;
          // Path is keyed by GROUP id so RLS policies match group membership
          const filePath = `${groupId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('note-attachments')
            .upload(filePath, file);

          if (uploadError) {
            setFileStatus(file, 'error', uploadError.message);
            throw uploadError;
          }
          newlyUploadedPaths.push(filePath);

          const { data: signedUrlData } = await supabase.storage
            .from('note-attachments')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);

          const isOcrTarget = file.type.startsWith('image/') || file.type === 'application/pdf';
          setFileStatus(file, isOcrTarget ? 'ocr' : 'done');

          return {
            url: signedUrlData?.signedUrl || '',
            path: filePath,
            name: file.name,
            type: file.type,
            size: file.size,
            _file: file,
          };
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        attachments = [...attachments, ...uploadedFiles.map(({ _file, ...rest }) => rest)];

        // OCR for images and PDFs using edge function — parallel + accumulate locally.
        // (state setters are async, so we cannot rely on `content` being updated
        // before we build noteData below — we must use a local string.)
        setProcessing(true);
        const ocrTargets = uploadedFiles.filter(
          f => f.type.startsWith('image/') || f.type === 'application/pdf'
        );
        // Mark non-OCR files as done/skipped
        for (const f of uploadedFiles) {
          if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) {
            setFileStatus(f._file, 'skipped', 'No transcription needed');
          }
        }
        const ocrResults = await Promise.allSettled(
          ocrTargets.map(f => {
            const key = `${f._file.name}:${f._file.size}`;
            const controller = new AbortController();
            ocrAbortersRef.current[key] = controller;
            return supabase.functions
              .invoke('ocr-extract', {
                body: { storagePath: f.path },
              } as Parameters<typeof supabase.functions.invoke>[1] & { signal?: AbortSignal })
              .then(
                v => {
                  if (controller.signal.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                  }
                  return v;
                },
                e => { throw e; },
              )
              .finally(() => {
                if (ocrAbortersRef.current[key] === controller) {
                  delete ocrAbortersRef.current[key];
                }
              });
          })
        );
        ocrResults.forEach((r, idx) => {
          const target = ocrTargets[idx];
          const key = `${target._file.name}:${target._file.size}`;
          // If the user cancelled this file, leave its 'cancelled' status alone
          if (fileStatuses[key]?.status === 'cancelled') return;
          if (r.status === 'fulfilled') {
            const txt = (r.value as { data?: { extractedText?: string } })?.data?.extractedText;
            if (txt && typeof txt === 'string' && txt.trim()) {
              ocrAppendText += '\n\n' + txt;
              setFileStatus(target._file, 'done', 'Transcribed');
              setFileOcrText(prev => ({ ...prev, [key]: txt }));
              setExpandedPreviews(prev => ({ ...prev, [key]: false }));
            } else {
              setFileStatus(target._file, 'done', 'No text found');
            }
          } else {
            const reason = (r.reason as { name?: string; message?: string }) || {};
            if (reason.name === 'AbortError') {
              setFileStatus(target._file, 'cancelled', 'Transcription cancelled');
              return;
            }
            console.error('OCR error:', r.reason);
            setFileStatus(target._file, 'error', 'Transcription failed');
          }
        });
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
                  Upload files (images & PDFs are auto-transcribed; originals are kept)
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
                {files.map((file, index) => {
                  const key = `${file.name}:${file.size}`;
                  const s = fileStatuses[key]?.status ?? 'pending';
                  const msg = fileStatuses[key]?.message;
                  const isOcrTarget =
                    file.type.startsWith('image/') || file.type === 'application/pdf';
                  let icon: JSX.Element;
                  let label: string;
                  let cls = 'text-muted-foreground';
                  switch (s) {
                    case 'uploading':
                      icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
                      label = 'Uploading…';
                      cls = 'text-indigo-500';
                      break;
                    case 'ocr':
                      icon = <ScanText className="h-3.5 w-3.5 animate-pulse" />;
                      label = 'Transcribing…';
                      cls = 'text-purple-500';
                      break;
                    case 'done':
                      icon = <CheckCircle2 className="h-3.5 w-3.5" />;
                      label = msg || 'Done';
                      cls = 'text-emerald-500';
                      break;
                    case 'skipped':
                      icon = <FileText className="h-3.5 w-3.5" />;
                      label = msg || 'Attached';
                      cls = 'text-muted-foreground';
                      break;
                    case 'error':
                      icon = <AlertCircle className="h-3.5 w-3.5" />;
                      label = msg || 'Error';
                      cls = 'text-destructive';
                      break;
                    case 'cancelled':
                      icon = <Ban className="h-3.5 w-3.5" />;
                      label = msg || 'Cancelled';
                      cls = 'text-muted-foreground';
                      break;
                    default:
                      icon = isOcrTarget ? (
                        <ScanText className="h-3.5 w-3.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      );
                      label = isOcrTarget ? 'Ready to transcribe' : 'Ready';
                  }
                  const ocrText = fileOcrText[key];
                  const expanded = !!expandedPreviews[key];
                  return (
                    <div key={index} className="bg-muted rounded-lg">
                    <div className="flex items-center justify-between gap-2 p-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm truncate">{file.name}</span>
                        <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${cls}`}>
                          {icon}
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {ocrText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() =>
                              setExpandedPreviews(prev => ({ ...prev, [key]: !prev[key] }))
                            }
                            title={expanded ? 'Hide extracted text' : 'Show extracted text'}
                          >
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            Preview
                          </Button>
                        )}
                        {s === 'ocr' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                            onClick={() => cancelOcr(file)}
                            title="Cancel transcription"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={s === 'uploading' || s === 'ocr'}
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {ocrText && expanded && (
                      <div className="border-t border-border/50 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            Extracted text ({ocrText.length.toLocaleString()} chars)
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(ocrText).then(
                                () => toast({ title: 'Copied', description: 'Extracted text copied to clipboard' }),
                                () => toast({ title: 'Copy failed', variant: 'destructive' }),
                              );
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <pre className="text-xs whitespace-pre-wrap break-words max-h-40 overflow-y-auto bg-background/50 rounded p-2 font-mono">
                          {ocrText}
                        </pre>
                      </div>
                    )}
                    </div>
                  );
                })}
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
