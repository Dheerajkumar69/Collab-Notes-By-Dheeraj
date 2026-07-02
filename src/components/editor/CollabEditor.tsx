/**
 * CollabEditor — the production-grade rich text editor.
 *
 * Capabilities:
 *  - Tiptap with Yjs CRDT collaboration (offline-safe merges, no overwrites).
 *  - Live cursors via @tiptap/extension-collaboration-cursor + awareness.
 *  - Local-first: y-indexeddb persists every keystroke locally; works offline.
 *  - Network sync via SupabaseYjsProvider over Realtime broadcast.
 *  - Slash menu (type "/"), tables, callouts, task lists, code blocks with
 *    syntax highlighting (lowlight), images, links, drag-handles.
 *  - Lazy migration: if the note has no yjs_state yet, we initialize the doc
 *    from the existing HTML once.
 *  - Periodic snapshot to Supabase (`yjs_state` + rendered `content` HTML)
 *    debounced to 1.5s, with offline outbox fallback.
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import CharacterCount from '@tiptap/extension-character-count';
import { common, createLowlight } from 'lowlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import AutoJoiner from 'tiptap-extension-auto-joiner';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SupabaseYjsProvider } from '@/lib/yjs/SupabaseYjsProvider';
import { createDebouncedPersister, decodeYjsState } from '@/lib/yjs/persistNote';
import { ensureOutboxAutoFlush } from '@/lib/offline/notesOutbox';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Callout } from './extensions/Callout';
import { SlashCommands } from './extensions/SlashMenu';
import { EditorToolbar } from './EditorToolbar';
import { Loader2, WifiOff, Cloud, CheckCircle2 } from 'lucide-react';

const lowlight = createLowlight(common);

// Stable, color-blind friendly per-user cursor color from a seed.
function userColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#14b8a6'];
  return palette[Math.abs(hash) % palette.length];
}

export interface CollabEditorProps {
  noteId: string;
  /** Existing HTML content used to lazy-initialize the Y.Doc on first open. */
  initialHtml: string;
  /** Existing yjs_state from the database (if note already migrated). */
  initialYjsState: Uint8Array | null;
  /** Currently signed-in user info for awareness/cursor labels. */
  currentUser: { id: string; name: string; color?: string };
  editable?: boolean;
  placeholder?: string;
  className?: string;
  onSavedStatus?: (status: 'saving' | 'saved' | 'offline' | 'error') => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export function CollabEditor({
  noteId,
  initialHtml,
  initialYjsState,
  currentUser,
  editable = true,
  placeholder = 'Press "/" for commands, or just start writing…',
  className = '',
  onSavedStatus,
}: CollabEditorProps) {
  const online = useOnlineStatus();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [ready, setReady] = useState(false);

  // Stable Y.Doc + Awareness + provider per noteId.
  const ydoc = useMemo(() => new Y.Doc(), [noteId]);
  const awareness = useMemo(() => new Awareness(ydoc), [ydoc]);
  const idbRef = useRef<IndexeddbPersistence | null>(null);
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const persisterRef = useRef<ReturnType<typeof createDebouncedPersister> | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const initializedRef = useRef(false);

  // Set up persistence layers and the network provider exactly once per noteId.
  useEffect(() => {
    let cancelled = false;
    ensureOutboxAutoFlush();

    const idb = new IndexeddbPersistence(`note:${noteId}`, ydoc);
    idbRef.current = idb;

    idb.whenSynced.then(() => {
      if (cancelled) return;
      // Lazy migration: if neither IDB nor server has any state, seed from HTML.
      const isEmpty = ydoc.share.size === 0 || (ydoc.getXmlFragment('default').length === 0);
      if (initialYjsState && initialYjsState.byteLength > 0) {
        try { Y.applyUpdate(ydoc, initialYjsState, 'server-init'); } catch (e) { console.warn('apply server state failed', e); }
      } else if (isEmpty && initialHtml && initialHtml.trim() && !initializedRef.current) {
        // We need the editor instance to convert HTML → ProseMirror → Y.Doc.
        // The actual seeding happens in the editor onCreate hook below.
      }
      // Connect to network last so we don't broadcast partial migration state.
      providerRef.current = new SupabaseYjsProvider({ noteId, doc: ydoc, awareness });
      setReady(true);
    });

    return () => {
      cancelled = true;
      try { providerRef.current?.destroy(); } catch { /* ignore */ }
      providerRef.current = null;
      try { idb.destroy(); } catch { /* ignore */ }
      idbRef.current = null;
    };
  }, [noteId, ydoc, awareness, initialYjsState, initialHtml]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs provides history.
        codeBlock: false, // Replaced with CodeBlockLowlight.
      }),
      Placeholder.configure({ placeholder }),
      Highlight,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
      Image.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: true, lastColumnResizable: true, allowTableNodeSelection: true }),
      TableRow, TableCell, TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      CharacterCount.configure({ limit: 200_000 }),
      Callout,
      SlashCommands,
      GlobalDragHandle.configure({ dragHandleWidth: 20 }),
      AutoJoiner,
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider: { awareness } as never, // tiptap only needs the awareness object.
        user: { name: currentUser.name, color: currentUser.color || userColor(currentUser.id) },
      }),
    ],
    editable,
    editorProps: {
      attributes: {
        class: 'collab-editor focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
    onCreate: ({ editor }) => {
      editorRef.current = editor as never;
      // If the doc is empty after IDB+server load, hydrate from legacy HTML once.
      const fragmentEmpty = editor.state.doc.childCount === 1 && editor.state.doc.firstChild?.content.size === 0;
      const noServerState = !initialYjsState || initialYjsState.byteLength === 0;
      if (fragmentEmpty && noServerState && initialHtml && initialHtml.trim() && !initializedRef.current) {
        initializedRef.current = true;
        editor.commands.setContent(initialHtml, { emitUpdate: true });
      }
    },
    onUpdate: () => {
      persisterRef.current?.schedule();
      setStatus('saving');
      onSavedStatus?.('saving');
    },
  }, [ydoc, editable]);

  // Wire the persister once we have the editor.
  useEffect(() => {
    if (!editor) return;
    persisterRef.current = createDebouncedPersister({
      noteId,
      doc: ydoc,
      getHtml: () => editor.getHTML(),
      online,
      onSaved: ({ offline }) => {
        const next: SaveStatus = offline ? 'offline' : 'saved';
        setStatus(next);
        onSavedStatus?.(next);
      },
      onError: () => {
        setStatus('error');
        onSavedStatus?.('error');
      },
    });
    return () => persisterRef.current?.cancel();
  }, [editor, ydoc, noteId, online, onSavedStatus]);

  // Flush pending save before unmount + on tab hide.
  useEffect(() => {
    const flush = () => persisterRef.current?.flush();
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    // Belt-and-suspenders: guarantee a snapshot at least every 10 seconds
    // while the tab is open so an accidental close never loses > 10s of work.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') flush();
    }, 10_000);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      flush();
      window.clearInterval(interval);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Toggle editable when prop changes.
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading editor…</div>;

  return (
    <div className={`relative rounded-lg border bg-background overflow-hidden ${className}`}>
      {editable && <EditorToolbar editor={editor} />}
      <div className="relative">
        <EditorContent editor={editor} />
        {!ready && (
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 text-[11px] text-muted-foreground">
        <SaveBadge status={status} online={online} />
        <span>{editor.storage.characterCount?.characters?.() ?? 0} chars</span>
      </div>
    </div>
  );
}

function SaveBadge({ status, online }: { status: SaveStatus; online: boolean }) {
  if (!online) return <span className="inline-flex items-center gap-1.5 text-amber-500"><WifiOff className="h-3 w-3" /> Offline — changes saved locally</span>;
  if (status === 'saving') return <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>;
  if (status === 'saved')  return <span className="inline-flex items-center gap-1.5 text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Saved</span>;
  if (status === 'offline') return <span className="inline-flex items-center gap-1.5 text-amber-500"><WifiOff className="h-3 w-3" /> Queued offline</span>;
  if (status === 'error') return <span className="text-destructive">Save failed — will retry</span>;
  return <span className="inline-flex items-center gap-1.5"><Cloud className="h-3 w-3" /> Synced</span>;
}

export { decodeYjsState };