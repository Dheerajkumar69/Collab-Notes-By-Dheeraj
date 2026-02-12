import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { History, RotateCcw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { RichTextViewer } from './RichTextEditor';

interface NoteVersion {
  id: string;
  note_id: string;
  title: string;
  content: string | null;
  version_number: number;
  created_by: string;
  created_at: string;
}

interface NoteVersionHistoryProps {
  noteId: string;
  currentTitle: string;
  currentContent: string;
  onRestore: (title: string, content: string) => void;
}

export function NoteVersionHistory({
  noteId,
  currentTitle,
  currentContent,
  onRestore,
}: NoteVersionHistoryProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
      if (data && data.length > 0) {
        setSelectedVersion(data[0]);
      }
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open, noteId]);

  const handleRestore = async (version: NoteVersion) => {
    try {
      onRestore(version.title, version.content || '');
      setOpen(false);
      toast({
        title: 'Version restored',
        description: `Restored to version ${version.version_number}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to restore version',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Version History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-120px)] mt-4">
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="text-muted-foreground">Loading versions...</div>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p>No previous versions</p>
              <p className="text-sm">Versions are saved automatically when you edit</p>
            </div>
          ) : (
            <div className="flex gap-4 flex-1 min-h-0">
              {/* Version List */}
              <ScrollArea className="w-56 flex-shrink-0">
                <div className="space-y-1 pr-2">
                  {/* Current version */}
                  <button
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      !selectedVersion ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedVersion(null)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        Current
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{currentTitle}</p>
                  </button>

                  {versions.map((version) => (
                    <button
                      key={version.id}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedVersion?.id === version.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          v{version.version_number}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{version.title}</p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(version.created_at), 'MMM d, h:mm a')}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>

              {/* Version Preview */}
              <div className="flex-1 border rounded-lg overflow-hidden min-h-0 flex flex-col">
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedVersion ? selectedVersion.title : currentTitle}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedVersion
                        ? `Version ${selectedVersion.version_number} • ${format(
                            new Date(selectedVersion.created_at),
                            'MMM d, yyyy h:mm a'
                          )}`
                        : 'Current version'}
                    </p>
                  </div>
                  {selectedVersion && (
                    <Button
                      size="sm"
                      onClick={() => handleRestore(selectedVersion)}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </Button>
                  )}
                </div>
                <ScrollArea className="flex-1 p-4">
                  <RichTextViewer
                    content={selectedVersion ? selectedVersion.content || '' : currentContent}
                  />
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
