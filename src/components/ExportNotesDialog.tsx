import { useState } from 'react';
import { Download, FileJson, FileText, FileType, Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useGroups } from '@/hooks/supabase-hooks';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Note = Tables<'notes'>;
type Group = Tables<'groups'>;

type ExportFormat = 'markdown' | 'json' | 'pdf';

export function ExportNotesDialog() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const { toast } = useToast();
  const { data: groups = [] } = useGroups();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const groupIds = (groups as Group[]).map(g => g.id);
      if (groupIds.length === 0) {
        toast({
          title: 'No groups found',
          description: 'Join or create a group first to export notes.',
          variant: 'destructive',
        });
        return;
      }

      let query = supabase
        .from('notes')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false });

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data: notes, error } = await query;

      if (error) throw error;
      if (!notes || notes.length === 0) {
        toast({
          title: 'No notes to export',
          description: 'Create some notes first.',
        });
        return;
      }

      if (format === 'pdf') {
        if (notes.length > 100) {
          toast({
            title: 'Too many notes',
            description: `PDF export is capped at 100 notes (you have ${notes.length}). Filter or archive some first.`,
            variant: 'destructive',
          });
          return;
        }
        const { exportNotesBundleToPdf } = await import('@/lib/pdfExport');
        await exportNotesBundleToPdf(
          (notes as Note[]).map(n => ({
            title: n.title,
            content: n.content,
            author_name: n.author_name,
            group_name: (groups as Group[]).find(g => g.id === n.group_id)?.name,
            created_at: n.created_at,
          })),
          {
            coverTitle: 'CollabNotes Export',
            onProgress: msg =>
              toast({ title: 'Generating PDF…', description: msg }),
          },
        );
        setExported(true);
        toast({ title: '✅ Export complete!', description: `Exported ${notes.length} notes as PDF.` });
        setTimeout(() => { setExported(false); setOpen(false); }, 1500);
        return;
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'markdown') {
        content = generateMarkdown(notes as Note[], groups as Group[]);
        filename = `collabnotes-export-${new Date().toISOString().split('T')[0]}.md`;
        mimeType = 'text/markdown';
      } else {
        content = JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            totalNotes: notes.length,
            notes: (notes as Note[]).map(note => ({
              ...note,
              groupName: (groups as Group[]).find(g => g.id === note.group_id)?.name,
            })),
          },
          null,
          2
        );
        filename = `collabnotes-export-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(true);
      toast({
        title: '✅ Export complete!',
        description: `Exported ${notes.length} notes as ${format.toUpperCase()}.`,
      });

      setTimeout(() => {
        setExported(false);
        setOpen(false);
      }, 1500);
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download size={18} />
          Export Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export Notes
          </DialogTitle>
          <DialogDescription>
            Download all your notes as a file for backup or offline access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  format === 'pdf' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setFormat('pdf')}
              >
                <RadioGroupItem value="pdf" id="pdf" />
                <FileType className={`h-5 w-5 ${format === 'pdf' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <Label htmlFor="pdf" className="cursor-pointer font-medium">PDF</Label>
                  <p className="text-xs text-muted-foreground">Single document with cover page, ideal for sharing</p>
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  format === 'markdown' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setFormat('markdown')}
              >
                <RadioGroupItem value="markdown" id="markdown" />
                <FileText className={`h-5 w-5 ${format === 'markdown' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <Label htmlFor="markdown" className="cursor-pointer font-medium">Markdown</Label>
                  <p className="text-xs text-muted-foreground">Human-readable, great for documentation</p>
                </div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  format === 'json' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setFormat('json')}
              >
                <RadioGroupItem value="json" id="json" />
                <FileJson className={`h-5 w-5 ${format === 'json' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <Label htmlFor="json" className="cursor-pointer font-medium">JSON</Label>
                  <p className="text-xs text-muted-foreground">Machine-readable, preserves all data</p>
                </div>
              </motion.div>
            </RadioGroup>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeArchived"
              checked={includeArchived}
              onCheckedChange={(checked) => setIncludeArchived(checked as boolean)}
            />
            <Label htmlFor="includeArchived" className="cursor-pointer">
              Include archived notes
            </Label>
          </div>

          {/* Export Button */}
          <Button
            className="w-full gap-2"
            onClick={handleExport}
            disabled={isExporting || exported}
          >
            {exported ? (
              <>
                <Check className="h-4 w-4" />
                Exported!
              </>
            ) : isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export All Notes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function generateMarkdown(notes: Note[], groups: Group[]): string {
  const lines: string[] = [
    '# CollabNotes Export',
    '',
    `Exported on: ${new Date().toLocaleString()}`,
    '',
    `Total notes: ${notes.length}`,
    '',
    '---',
    '',
  ];

  // Group notes by group
  const notesByGroup = new Map<string, Note[]>();
  notes.forEach(note => {
    const existing = notesByGroup.get(note.group_id) || [];
    existing.push(note);
    notesByGroup.set(note.group_id, existing);
  });

  notesByGroup.forEach((groupNotes, groupId) => {
    const group = groups.find(g => g.id === groupId);
    lines.push(`## ${group?.name || 'Unknown Group'}`);
    lines.push('');

    groupNotes.forEach(note => {
      lines.push(`### ${note.title}`);
      lines.push('');
      if (note.labels && note.labels.length > 0) {
        lines.push(`**Labels:** ${note.labels.join(', ')}`);
        lines.push('');
      }
      if (note.author_name) {
        lines.push(`**Author:** ${note.author_name}`);
      }
      if (note.created_at) {
        lines.push(`**Created:** ${new Date(note.created_at).toLocaleString()}`);
      }
      if (note.is_pinned) {
        lines.push(`**📌 Pinned**`);
      }
      if (note.is_archived) {
        lines.push(`**📦 Archived**`);
      }
      lines.push('');
      if (note.content) {
        lines.push(note.content);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    });
  });

  return lines.join('\n');
}
