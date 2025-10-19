import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface NoteViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: any;
}

export function NoteViewDialog({ open, onOpenChange, note }: NoteViewDialogProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = note.attachments?.filter((a: any) => a.type?.startsWith('image/')) || [];
  const files = note.attachments?.filter((a: any) => !a.type?.startsWith('image/')) || [];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{note.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Viewer */}
          {images.length > 0 && (
            <div className="relative">
              <img
                src={images[currentImageIndex].url}
                alt="Note attachment"
                className="w-full rounded-lg"
              />
              {images.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={prevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={nextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Content */}
          {note.content && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{note.content}</ReactMarkdown>
            </div>
          )}

          {/* Labels */}
          {note.labels && note.labels.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {note.labels.map((label: string) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          )}

          {/* File Attachments */}
          {files.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Attachments</h3>
              <div className="space-y-2">
                {files.map((file: any, index: number) => (
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

          {/* Metadata */}
          <div className="border-t pt-4 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Author: {note.author_name}</span>
              <span>
                {note.created_at && format(new Date(note.created_at), 'PPp')}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
