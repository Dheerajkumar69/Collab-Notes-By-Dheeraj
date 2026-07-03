import { Component, type ReactNode } from 'react';
import { CollabEditor, type CollabEditorProps } from './CollabEditor';
import { RichTextViewer } from '@/components/RichTextEditor';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props extends CollabEditorProps {
  fallbackHtml?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  key: number;
}

/**
 * Local error boundary around the collaborative editor.
 * If Tiptap/Yjs/collab-caret crash, the note stays readable
 * (rendered as static HTML) instead of taking down the whole page.
 */
export class CollabEditorSafe extends Component<Props, State> {
  state: State = { hasError: false, error: null, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('[CollabEditor] crashed:', error);
  }

  private retry = () => {
    this.setState((s) => ({ hasError: false, error: null, key: s.key + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border bg-background overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Live editor unavailable — showing read-only view.</span>
            </div>
            <Button size="sm" variant="ghost" onClick={this.retry} className="h-7 gap-1">
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </div>
          <div className="p-4">
            {this.props.fallbackHtml || this.props.initialHtml ? (
              <RichTextViewer content={this.props.fallbackHtml || this.props.initialHtml} />
            ) : (
              <p className="text-muted-foreground italic">No content yet.</p>
            )}
          </div>
        </div>
      );
    }
    return <CollabEditor key={this.state.key} {...this.props} />;
  }
}