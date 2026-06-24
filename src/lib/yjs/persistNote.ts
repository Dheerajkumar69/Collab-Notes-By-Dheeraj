/**
 * Persists Yjs state and rendered HTML for a note.
 *
 * Strategy:
 *  - We debounce saves (default 1.5s after last update).
 *  - We persist BOTH `yjs_state` (binary, source of truth) and `content` (HTML
 *    snapshot used by NoteCard previews, search, AI summarize, exports).
 *  - We bump `version` on each save (for the existing optimistic-concurrency
 *    UI on the legacy editor; the Y.Doc itself is conflict-free).
 *  - When offline, the write is queued via the notes outbox.
 */
import * as Y from 'yjs';
import { supabase } from '@/integrations/supabase/client';
import { enqueueNoteUpdate, flushOutbox } from '@/lib/offline/notesOutbox';

/** 8 MB — well above any realistic note, but small enough to keep PostgREST happy. */
const MAX_YJS_STATE_BYTES = 8 * 1024 * 1024;

export interface PersistOptions {
  noteId: string;
  doc: Y.Doc;
  getHtml: () => string;
  online: boolean;
  onSaved?: (info: { savedAt: Date; offline: boolean }) => void;
  onError?: (err: unknown) => void;
}

export function createDebouncedPersister(opts: PersistOptions, debounceMs = 1500) {
  let timer: number | null = null;
  let inFlight = false;
  let pending = false;

  const flush = async () => {
    if (inFlight) { pending = true; return; }
    inFlight = true;
    pending = false;
    try {
      const state = Y.encodeStateAsUpdate(opts.doc);
      if (state.byteLength > MAX_YJS_STATE_BYTES) {
        // Don't silently corrupt the row — surface and skip this snapshot.
        opts.onError?.(new Error(`Yjs state exceeds ${MAX_YJS_STATE_BYTES} bytes (${state.byteLength})`));
        return;
      }
      // Convert Uint8Array -> hex for bytea (\x prefix) so PostgREST stores it correctly.
      const hex = '\\x' + Array.from(state).map(b => b.toString(16).padStart(2, '0')).join('');
      const html = opts.getHtml();
      const payload = {
        yjs_state: hex,
        content: html,
        format: 'yjs',
        updated_at: new Date().toISOString(),
      };

      const queueOffline = async () => {
        try {
          await enqueueNoteUpdate(opts.noteId, payload);
          opts.onSaved?.({ savedAt: new Date(), offline: true });
        } catch (err) {
          // IndexedDB unavailable (private mode, quota, blocked upgrade). Surface.
          opts.onError?.(err);
        }
      };

      if (!opts.online) {
        await queueOffline();
      } else {
        const { error } = await supabase
          .from('notes')
          .update(payload as never)
          .eq('id', opts.noteId);
        if (error) {
          // Network glitched mid-write — fall back to outbox.
          await queueOffline();
        } else {
          opts.onSaved?.({ savedAt: new Date(), offline: false });
          // Opportunistically drain any older queued entries now that we're online.
          void flushOutbox().catch(() => { /* best-effort */ });
        }
      }
    } catch (e) {
      opts.onError?.(e);
    } finally {
      inFlight = false;
      if (pending) {
        // Coalesce a follow-up save after a short delay.
        timer = window.setTimeout(flush, 200);
      }
    }
  };

  const schedule = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(flush, debounceMs);
  };

  const cancel = () => {
    if (timer) { window.clearTimeout(timer); timer = null; }
  };

  return { schedule, flush, cancel };
}

/**
 * Decode a bytea hex string returned by PostgREST back into a Uint8Array.
 * Supabase returns bytea as either "\x..." hex or base64 depending on adapter;
 * we handle both.
 */
export function decodeYjsState(value: unknown): Uint8Array | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) {
      const hex = value.slice(2);
      if (hex.length % 2 !== 0) return null;
      const u8 = new Uint8Array(hex.length / 2);
      for (let i = 0; i < u8.length; i++) {
        const byte = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        if (Number.isNaN(byte)) return null;
        u8[i] = byte;
      }
      return u8;
    }
    // base64
    try {
      const bin = atob(value);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return u8;
    } catch {
      return null;
    }
  }
  return null;
}