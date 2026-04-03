import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, BookOpen, CheckSquare, FolderKanban, FlaskConical } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  is_system: boolean;
}

interface NoteTemplatesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (content: string, title: string) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'meeting': return <FileText className="h-5 w-5" />;
    case 'lecture': return <BookOpen className="h-5 w-5" />;
    case 'todo': return <CheckSquare className="h-5 w-5" />;
    case 'project': return <FolderKanban className="h-5 w-5" />;
    case 'research': return <FlaskConical className="h-5 w-5" />;
    default: return <FileText className="h-5 w-5" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'meeting': return 'bg-blue-500/10 text-blue-600';
    case 'lecture': return 'bg-green-500/10 text-green-600';
    case 'todo': return 'bg-purple-500/10 text-purple-600';
    case 'project': return 'bg-orange-500/10 text-orange-600';
    case 'research': return 'bg-pink-500/10 text-pink-600';
    default: return 'bg-muted text-muted-foreground';
  }
};

export function NoteTemplates({ open, onOpenChange, onSelect }: NoteTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('note_templates')
      .select('*')
      .order('category');
    setTemplates(data || []);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading templates...</div>
        ) : (
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
            {/* Blank option */}
            <Card
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-dashed"
              onClick={() => {
                onSelect('', 'Untitled');
                onOpenChange(false);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Blank Note</p>
                  <p className="text-xs text-muted-foreground">Start from scratch</p>
                </div>
              </div>
            </Card>

            {templates.map((template) => (
              <Card
                key={template.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onSelect(template.content, template.name);
                  onOpenChange(false);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getCategoryColor(template.category)}`}>
                    {getCategoryIcon(template.category)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{template.name}</p>
                      {template.is_system && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">System</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
