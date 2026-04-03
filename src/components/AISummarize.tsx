import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

interface AISummarizeProps {
  noteTitle: string;
  noteContent: string;
}

export function AISummarize({ noteTitle, noteContent }: AISummarizeProps) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const summarize = async () => {
    if (!noteContent?.trim()) {
      toast({ title: 'No content', description: 'Add some content first to summarize.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setOpen(true);
    setSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-summarize', {
        body: { content: noteContent, title: noteTitle },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to summarize', variant: 'destructive' });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={summarize}>
        <Sparkles className="h-3.5 w-3.5" />
        AI Summary
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Summary
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Summarizing...</span>
            </div>
          ) : summary ? (
            <div>
              <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 p-4 rounded-lg">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
              <div className="flex justify-end mt-4">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
