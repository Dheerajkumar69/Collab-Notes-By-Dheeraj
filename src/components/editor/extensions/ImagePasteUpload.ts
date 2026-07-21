/**
 * ImagePasteUpload — intercepts clipboard-paste and file-drop events, uploads
 * every image to Supabase Storage (`note-attachments`), and inserts a Tiptap
 * image node at the cursor / drop position with a long-lived signed URL.
 *
 * Guarantees:
 *  - Only images are handled here (other files are left to other handlers).
 *  - Each image gets a fresh crypto.randomUUID() filename — never predictable.
 *  - Scoped under `{groupId}/{noteId}/inline/{uuid}.{ext}` so RLS policies
 *    that check group membership on the first path segment still apply.
 *  - Instant placeholder: a base64 thumbnail is inserted first so the user
 *    sees the image immediately. Once upload finishes, the src is swapped
 *    for the signed URL. If upload fails, the placeholder is removed and
 *    a toast is shown.
 *  - Files > 10 MB are rejected with a toast (matches ChatFileUpload).
 *  - The plugin never throws — any error is caught, logged, and toasted.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const YEAR_SECONDS = 60 * 60 * 24 * 365;

function extFromMime(mime: string, fallback = 'png'): string {
  const map: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
    'image/heic': 'heic', 'image/heif': 'heif', 'image/avif': 'avif',
  };
  return map[mime.toLowerCase()] || fallback;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function uploadImage(file: File, groupId: string, noteId: string): Promise<string> {
  const ext = extFromMime(file.type, file.name.split('.').pop() || 'png');
  const path = `${groupId}/${noteId}/inline/${crypto.randomUUID()}.${ext}`;
  // Preflight: ensure we have an authenticated session — RLS on
  // note-attachments requires auth.uid() to match a group member/creator.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('You are signed out — please sign in again to paste images.');
  }
  const { error: upErr } = await supabase.storage.from('note-attachments').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) {
    const msg = upErr.message || '';
    if (/row-level security|not authorized|permission/i.test(msg)) {
      throw new Error(
        "Can't save image — you must be a member of this group. Try refreshing the page.",
      );
    }
    throw upErr;
  }
  const { data, error: signErr } = await supabase.storage
    .from('note-attachments')
    .createSignedUrl(path, YEAR_SECONDS);
  if (signErr || !data?.signedUrl) throw signErr || new Error('Failed to sign URL');

  // Fire-and-forget: archive a copy of the image into the Telegram backup channel.
  // Never blocks the paste, never surfaces errors to the user.
  void supabase.functions
    .invoke('telegram-sync', {
      body: {
        action: 'archive-image',
        groupId,
        noteId,
        imageUrl: data.signedUrl,
        filename: file.name || `image.${ext}`,
      },
    })
    .catch((err) => console.warn('[ImagePasteUpload] telegram archive skipped:', err));

  return data.signedUrl;
}

export interface ImagePasteUploadOptions {
  groupId: string;
  noteId: string;
  enabled: boolean;
}

export const ImagePasteUpload = Extension.create<ImagePasteUploadOptions>({
  name: 'imagePasteUpload',
  addOptions() {
    return { groupId: '', noteId: '', enabled: true };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    const editor = this.editor;

    const insertPlaceholderAndUpload = (file: File, pos: number | null) => {
      if (!opts.enabled || !opts.groupId || !opts.noteId) return false;
      if (!file.type.startsWith('image/')) return false;
      if (file.size > MAX_BYTES) {
        toast({ title: 'Image too large', description: 'Max 10 MB per image.', variant: 'destructive' });
        return true;
      }
      // Unique marker so we can locate & replace the placeholder later.
      const marker = `pending://${crypto.randomUUID()}`;
      (async () => {
        try {
          const dataUrl = await fileToDataUrl(file);
          // Insert placeholder at position (or current selection).
          const insertAt = pos ?? editor.state.selection.from;
          editor
            .chain()
            .insertContentAt(insertAt, {
              type: 'image',
              attrs: { src: dataUrl, alt: file.name, title: marker },
            })
            .run();

          const signedUrl = await uploadImage(file, opts.groupId, opts.noteId);

          // Find the placeholder by its unique title marker and swap the src.
          const { state } = editor;
          let foundPos: number | null = null;
          state.doc.descendants((node, p) => {
            if (node.type.name === 'image' && node.attrs.title === marker) {
              foundPos = p;
              return false;
            }
            return true;
          });
          if (foundPos !== null) {
            const tr = editor.state.tr.setNodeMarkup(foundPos, undefined, {
              src: signedUrl,
              alt: file.name,
              title: null,
            });
            editor.view.dispatch(tr);
          }
        } catch (err) {
          console.error('[ImagePasteUpload] failed:', err);
          // Remove the placeholder on failure.
          const { state } = editor;
          let foundPos: number | null = null;
          state.doc.descendants((node, p) => {
            if (node.type.name === 'image' && node.attrs.title === marker) {
              foundPos = p;
              return false;
            }
            return true;
          });
          if (foundPos !== null) {
            const from = foundPos;
            const to = from + 1;
            editor.view.dispatch(editor.state.tr.delete(from, to));
          }
          toast({
            title: 'Image upload failed',
            description: err instanceof Error ? err.message : 'Please try again.',
            variant: 'destructive',
          });
        }
      })();
      return true;
    };

    return [
      new Plugin({
        key: new PluginKey('imagePasteUpload'),
        props: {
          handlePaste: (_view, event) => {
            const items = event.clipboardData?.items;
            if (!items || items.length === 0) return false;
            const images: File[] = [];
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              if (it.kind === 'file' && it.type.startsWith('image/')) {
                const f = it.getAsFile();
                if (f) images.push(f);
              }
            }
            if (images.length === 0) return false;
            event.preventDefault();
            for (const f of images) insertPlaceholderAndUpload(f, null);
            return true;
          },
          handleDrop: (view, event) => {
            const dt = event.dataTransfer;
            if (!dt || !dt.files || dt.files.length === 0) return false;
            const images = Array.from(dt.files).filter((f) => f.type.startsWith('image/'));
            if (images.length === 0) return false;
            event.preventDefault();
            const coords = { left: event.clientX, top: event.clientY };
            const pos = view.posAtCoords(coords)?.pos ?? null;
            for (const f of images) insertPlaceholderAndUpload(f, pos);
            return true;
          },
        },
      }),
    ];
  },
});