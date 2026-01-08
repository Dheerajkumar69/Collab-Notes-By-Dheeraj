import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Image, FileText, File } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ChatAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface ChatFileUploadProps {
  onFilesSelected: (attachments: ChatAttachment[]) => void;
  pendingFiles: ChatAttachment[];
  onRemoveFile: (index: number) => void;
  groupId: string;
  disabled?: boolean;
}

export const ChatFileUpload = ({
  onFilesSelected,
  pendingFiles,
  onRemoveFile,
  groupId,
  disabled,
}: ChatFileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedFiles: ChatAttachment[] = [];

    try {
      for (const file of Array.from(files)) {
        // Limit file size to 10MB
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: `${file.name} exceeds 10MB limit`,
            variant: 'destructive',
          });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${groupId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
          .from('note-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('note-attachments')
          .getPublicUrl(fileName);

        uploadedFiles.push({
          url: urlData.publicUrl,
          name: file.name,
          type: file.type,
          size: file.size,
        });
      }

      if (uploadedFiles.length > 0) {
        onFilesSelected(uploadedFiles);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* File previews */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap p-2 bg-muted/50 rounded-lg">
          {pendingFiles.map((file, index) => (
            <div
              key={index}
              className="relative bg-background rounded-lg border p-2 flex items-center gap-2"
            >
              {file.type.startsWith('image/') ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="h-10 w-10 object-cover rounded"
                />
              ) : (
                <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                  {getFileIcon(file.type)}
                </div>
              )}
              <div className="flex flex-col max-w-[120px]">
                <span className="text-xs font-medium truncate">{file.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full"
                onClick={() => onRemoveFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || disabled}
        className="h-9 w-9"
      >
        <Paperclip className={`h-4 w-4 ${uploading ? 'animate-pulse' : ''}`} />
      </Button>
    </div>
  );
};

interface ChatAttachmentPreviewProps {
  attachments: ChatAttachment[];
  isOwnMessage: boolean;
}

export const ChatAttachmentPreview = ({
  attachments,
  isOwnMessage,
}: ChatAttachmentPreviewProps) => {
  if (!attachments || attachments.length === 0) return null;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="flex flex-col gap-2 mb-2">
      {attachments.map((attachment, index) => (
        <div key={index}>
          {attachment.type.startsWith('image/') ? (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-w-[200px] max-h-[200px] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              />
            </a>
          ) : (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center gap-2 p-2 rounded-lg ${isOwnMessage
                  ? 'bg-white/10 hover:bg-white/20'
                  : 'bg-background/50 hover:bg-background/70'
                } transition-colors`}
            >
              {getFileIcon(attachment.type)}
              <span className="text-xs truncate max-w-[150px]">{attachment.name}</span>
            </a>
          )}
        </div>
      ))}
    </div>
  );
};
