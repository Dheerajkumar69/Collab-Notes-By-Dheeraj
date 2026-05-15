/**
 * SupabaseYjsProvider — a Yjs network provider that uses Supabase Realtime
 * broadcast as the transport. Implements the standard y-protocols sync +
 * awareness handshake so it interops with Tiptap's @tiptap/extension-collaboration
 * and @tiptap/extension-collaboration-cursor.
 *
 * Wire protocol (all payloads base64-encoded Uint8Arrays over Supabase broadcast):
 *   - "sync"      : { step: 1 | 2, payload }   // y-protocols/sync messages
 *   - "update"    : { payload }                // raw Y.Doc update
 *   - "awareness" : { payload }                // awareness update
 *   - "query-aw"  : {}                         // ask peers for current awareness
 *
 * Edge cases handled:
 *   - Local-origin guard: never re-emit our own updates as remote.
 *   - Late-joiner sync: on SUBSCRIBED we send sync-step1; peers reply with step-2.
 *   - Awareness on unload: emit removeStates({clientID}) so cursors disappear.
 *   - Reconnect storms: presence/sync handshake is idempotent, repeating it is safe.
 *   - Channel cleanup: destroy() removes the channel and all listeners.
 */
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

function u8ToB64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
function b64ToU8(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export interface SupabaseYjsProviderOptions {
  noteId: string;
  doc: Y.Doc;
  awareness?: Awareness;
}

export class SupabaseYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly noteId: string;
  private channel: RealtimeChannel | null = null;
  private subscribed = false;
  private destroyed = false;
  private onDocUpdate: (update: Uint8Array, origin: unknown) => void;
  private onAwarenessUpdate: (changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => void;
  private onUnload: () => void;

  constructor(opts: SupabaseYjsProviderOptions) {
    this.noteId = opts.noteId;
    this.doc = opts.doc;
    this.awareness = opts.awareness ?? new Awareness(opts.doc);

    // Forward local doc updates to peers (skip our own remote-applied updates).
    this.onDocUpdate = (update, origin) => {
      if (origin === this) return;
      this.broadcast('update', { payload: u8ToB64(update) });
    };
    this.doc.on('update', this.onDocUpdate);

    // Forward local awareness changes to peers.
    this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === 'remote') return;
      const changedClients = added.concat(updated).concat(removed);
      const payload = encodeAwarenessUpdate(this.awareness, changedClients);
      this.broadcast('awareness', { payload: u8ToB64(payload) });
    };
    this.awareness.on('update', this.onAwarenessUpdate);

    // Tell peers we're gone on tab close.
    this.onUnload = () => {
      removeAwarenessStates(this.awareness, [this.doc.clientID], 'window unload');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.onUnload);
    }

    this.connect();
  }

  private connect() {
    const channel = supabase.channel(`note-yjs:${this.noteId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    this.channel = channel;

    channel.on('broadcast', { event: 'sync' }, ({ payload }) => this.handleSync(payload));
    channel.on('broadcast', { event: 'update' }, ({ payload }) => this.handleUpdate(payload));
    channel.on('broadcast', { event: 'awareness' }, ({ payload }) => this.handleAwareness(payload));
    channel.on('broadcast', { event: 'query-aw' }, () => this.replyAwareness());

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        this.subscribed = true;
        // Initiate y-protocols sync step 1.
        const enc = encoding.createEncoder();
        syncProtocol.writeSyncStep1(enc, this.doc);
        this.broadcast('sync', { step: 1, payload: u8ToB64(encoding.toUint8Array(enc)) });
        // Ask peers to share their awareness.
        this.broadcast('query-aw', {});
        // Push our own awareness state.
        const awPayload = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
        this.broadcast('awareness', { payload: u8ToB64(awPayload) });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.subscribed = false;
      }
    });
  }

  private broadcast(event: string, payload: Record<string, unknown>) {
    const ch = this.channel;
    if (!ch || !this.subscribed) return;
    void ch.send({ type: 'broadcast', event, payload }).catch(() => { /* ignore transient */ });
  }

  private handleSync(payload: { step: number; payload: string }) {
    if (!payload?.payload) return;
    try {
      const data = b64ToU8(payload.payload);
      const dec = decoding.createDecoder(data);
      const enc = encoding.createEncoder();
      // readSyncMessage handles both step1 (state vector) and step2 (update).
      const messageType = syncProtocol.readSyncMessage(dec, enc, this.doc, this);
      // If a reply was generated (step2), emit it.
      if (messageType === syncProtocol.messageYjsSyncStep1) {
        this.broadcast('sync', { step: 2, payload: u8ToB64(encoding.toUint8Array(enc)) });
      }
    } catch (e) {
      console.warn('[YjsProvider] handleSync failed', e);
    }
  }

  private handleUpdate(payload: { payload: string }) {
    if (!payload?.payload) return;
    try {
      Y.applyUpdate(this.doc, b64ToU8(payload.payload), this);
    } catch (e) {
      console.warn('[YjsProvider] handleUpdate failed', e);
    }
  }

  private handleAwareness(payload: { payload: string }) {
    if (!payload?.payload) return;
    try {
      applyAwarenessUpdate(this.awareness, b64ToU8(payload.payload), 'remote');
    } catch (e) {
      console.warn('[YjsProvider] handleAwareness failed', e);
    }
  }

  private replyAwareness() {
    const states = Array.from(this.awareness.getStates().keys());
    if (!states.length) return;
    const payload = encodeAwarenessUpdate(this.awareness, states);
    this.broadcast('awareness', { payload: u8ToB64(payload) });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.doc.off('update', this.onDocUpdate); } catch { /* ignore */ }
    try { this.awareness.off('update', this.onAwarenessUpdate); } catch { /* ignore */ }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.onUnload);
    }
    try { removeAwarenessStates(this.awareness, [this.doc.clientID], 'provider destroy'); } catch { /* ignore */ }
    if (this.channel) {
      try { supabase.removeChannel(this.channel); } catch { /* ignore */ }
      this.channel = null;
    }
  }
}