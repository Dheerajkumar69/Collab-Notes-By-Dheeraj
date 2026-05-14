import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, Code, FileType, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface NoteExportProps {
  title: string;
  content: string;
  authorName?: string | null;
  groupName?: string;
  createdAt?: string | null;
}

function htmlToMarkdown(html: string): string {
  let md = html;
  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  // Bold/italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '$1');
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');
  // Blockquote
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n');
  // Code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n\n');
  // Paragraphs & breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<hr\s*\/?>/gi, '---\n\n');
  // Highlight
  md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
  // Strip remaining tags
  md = md.replace(/<[^>]*>/g, '');
  // Clean up
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

export function NoteExport({ title, content, authorName, groupName, createdAt }: NoteExportProps) {
  const [exporting, setExporting] = useState(false);
  const downloadFile = (data: string, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: `${filename} saved` });
  };

  const exportMarkdown = () => {
    const markdown = `# ${title}\n\n${htmlToMarkdown(content || '')}`;
    downloadFile(markdown, `${title.replace(/[^a-z0-9]/gi, '_')}.md`, 'text/markdown');
  };

  const exportHTML = () => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333}
h1,h2,h3{color:#111}mark{background:#fef08a;padding:2px 4px}blockquote{border-left:3px solid #ddd;margin:0;padding-left:16px;color:#666}</style>
</head><body><h1>${title}</h1>${content || ''}</body></html>`;
    downloadFile(html, `${title.replace(/[^a-z0-9]/gi, '_')}.html`, 'text/html');
  };

  const exportPDF = async () => {
    setExporting(true);
    const id = toast({ title: 'Generating PDF…', description: 'Loading engine' });
    try {
      const { exportNoteToPdf } = await import('@/lib/pdfExport');
      await exportNoteToPdf(
        { title, content, author_name: authorName, group_name: groupName, created_at: createdAt },
        msg => id.update({ id: id.id, title: 'Generating PDF…', description: msg }),
      );
      id.update({ id: id.id, title: 'Downloaded', description: 'PDF saved' });
    } catch (e: any) {
      id.update({ id: id.id, title: 'PDF export failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" disabled={exporting}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportPDF} disabled={exporting}>
          <FileType className="h-4 w-4 mr-2" />
          PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportMarkdown}>
          <Code className="h-4 w-4 mr-2" />
          Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportHTML}>
          <FileText className="h-4 w-4 mr-2" />
          HTML (.html)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
