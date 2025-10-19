import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { Upload, X, Loader2 } from 'lucide-react';

interface CreateNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onSuccess: () => void;
  editingNote?: any;
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
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [color, setColor] = useState('white');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (editingNote) {
      setTitle(editingNote.title || '');
      setContent(editingNote.content || '');
      setLabels(editingNote.labels || []);
      setColor(editingNote.color || 'white');
    } else {
      resetForm();
    }
  }, [editingNote, open]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setLabels([]);
    setNewLabel('');
    setColor('white');
    setFiles([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      setLabels([...labels, newLabel.trim()]);
      setNewLabel('');
    }
  };

  const removeLabel = (label: string) => {
    setLabels(labels.filter(l => l !== label));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a title',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      let attachments: any[] = editingNote?.attachments || [];

      // Upload files
      if (files.length > 0) {
        const uploadPromises = files.map(async file => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user?.id}/${fileName}`;

          const { error: uploadError, data } = await supabase.storage
            .from('note-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage.from('note-attachments').getPublicUrl(filePath);

          return {
            url: publicUrl,
            name: file.name,
            type: file.type,
            size: file.size,
          };
        });

        const uploadedFiles = await Promise.all(uploadPromises);
        attachments = [...attachments, ...uploadedFiles];

        // OCR for images
        setProcessing(true);
        for (const file of uploadedFiles) {
          if (file.type.startsWith('image/')) {
            try {
              const response = await fetch(
                'https://api.openai.com/v1/chat/completions',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                      {
                        role: 'user',
                        content: [
                          {
                            type: 'text',
                            text: 'Extract all text from this image. Return only the extracted text, nothing else.',
                          },
                          {
                            type: 'image_url',
                            image_url: { url: file.url },
                          },
                        ],
                      },
                    ],
                    max_tokens: 1000,
                  }),
                }
              );

              if (response.ok) {
                const data = await response.json();
                const extractedText = data.choices[0]?.message?.content || '';
                if (extractedText) {
                  setContent(prev => prev + '\n\n' + extractedText);
                }
              }
            } catch (error) {
              console.error('OCR error:', error);
            }
          }
        }
      }

      // Get user profile for author name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      const noteData = {
        title,
        content,
        group_id: groupId,
        labels,
        color,
        attachments,
        author_name: profile?.full_name || 'User',
        created_by: user?.id,
      };

      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update(noteData)
          .eq('id', editingNote.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Note updated successfully',
        });
      } else {
        const { error } = await supabase.from('notes').insert([noteData]);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Note created successfully',
        });
      }

      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast({
        title: 'Error',
        description: 'Failed to save note',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingNote ? 'Edit Note' : 'Create Note'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Note title"
            />
          </div>

          <div>
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your note... (Markdown supported)"
              rows={8}
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
                onKeyPress={e => e.key === 'Enter' && addLabel()}
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
                  onClick={() => setColor(c.value)}
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
  );
}
