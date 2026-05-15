/**
 * IndexedDB-backed outbox for note writes that occur while offline.
 *
 * Only "metadata-style" writes go through here (title, labels, pin, color,
 * lecture metadata, due_date, archive, attachments, AND the periodic Yjs
 * state snapshot when the user is offline). Live-collab updates between
 * peers are handled by Yjs itself; this outbox just makes sure the latest
 * state lands in the database when we come back online.
 *
 * Behaviors:
 *  - Per-note coalescing: a queued payload is merged with the new payload.
 *  - Replay-on-reconnect via 'online' event + manual flushOutbox().
 *  - Stale-write protection: we only push the LATEST payload per note.
 *  - Survives reloads (IndexedDB).
 */

const DB_NAME = 'collab-notes-outbox';
const DB_VERSION = 1;
const STORE = 'note_updates';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'noteId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

interface OutboxEntry {
  noteId: string;
  payload: Record<string, unknown>;
  queuedAt: number;
}

export async function enqueueNoteUpdate(noteId: string, payload: Record<string, unknown>): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const get = store.get(noteId);
    get.onsuccess = () => {
      const existing = (get.result as OutboxEntry | undefined)?.payload ?? {};
      const merged: OutboxEntry = {
        noteId,
        payload: { ...existing, ...payload },
        queuedAt: Date.now(),
      };
      store.put(merged);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OutboxEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOutboxEntry(noteId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(noteId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function outboxSize(): Promise<number> {
  const entries = await listOutbox();
  return entries.length;
}

/**
 * Flush all queued writes. Resolves with { ok, failed } counts.
 * Safe to call repeatedly. Uses dynamic import of supabase to avoid
 * circular module init.
 */
export async function flushOutbox(): Promise<{ ok: number; failed: number }> {
  const { supabase } = await import('@/integrations/supabase/client');
  const entries = await listOutbox();
  let ok = 0, failed = 0;
  for (const e of entries) {
    try {
      const { error } = await supabase
        .from('notes')
        .update(e.payload as never)
        .eq('id', e.noteId);
      if (error) { failed++; continue; }
      await deleteOutboxEntry(e.noteId);
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, failed };
}

let listenersAttached = false;

/** Attach a single global listener that flushes the outbox when we come online. */
export function ensureOutboxAutoFlush(onFlushed?: (r: { ok: number; failed: number }) => void) {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  const handler = async () => {
    if (!navigator.onLine) return;
    const r = await flushOutbox();
    if (r.ok || r.failed) onFlushed?.(r);
  };
  window.addEventListener('online', handler);
  // Also flush on startup in case last session ended offline.
  if (navigator.onLine) {
    setTimeout(handler, 1500);
  }
}