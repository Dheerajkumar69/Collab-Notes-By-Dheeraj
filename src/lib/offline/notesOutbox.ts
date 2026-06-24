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
/** Hard ceiling on queue size to keep a hostile/offline tab from filling IndexedDB. */
const MAX_ENTRIES = 500;

let dbPromise: Promise<IDBDatabase> | null = null;
let flushInFlight: Promise<{ ok: number; failed: number }> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onblocked = () => {
      // Another tab is holding an older version open; surface as error so caller
      // can fall back to a network write instead of hanging forever.
      reject(new Error('Outbox DB upgrade blocked by another tab'));
    };
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'noteId' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // If the schema changes elsewhere, close gracefully so the next call reopens.
      db.onversionchange = () => {
        try { db.close(); } catch { /* ignore */ }
        dbPromise = null;
      };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

interface OutboxEntry {
  noteId: string;
  payload: Record<string, unknown>;
  queuedAt: number;
}

export async function enqueueNoteUpdate(noteId: string, payload: Record<string, unknown>): Promise<void> {
  if (!noteId) throw new Error('enqueueNoteUpdate: noteId required');
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, 'readwrite');
    } catch (e) {
      reject(e);
      return;
    }
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    const getReq = store.get(noteId);
    getReq.onsuccess = () => {
      const existing = (getReq.result as OutboxEntry | undefined)?.payload ?? {};
      const isNewEntry = getReq.result === undefined;
      // Drop new entries (not updates to existing notes) once we hit the ceiling
      // to avoid unbounded growth, but never reject an update for an already-queued note.
      if (isNewEntry && (countReq.result ?? 0) >= MAX_ENTRIES) {
        return;
      }
      const merged: OutboxEntry = {
        noteId,
        payload: { ...existing, ...payload },
        queuedAt: Date.now(),
      };
      store.put(merged);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Outbox tx aborted'));
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
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
  const { supabase } = await import('@/integrations/supabase/client');
  const entries = await listOutbox();
  let ok = 0, failed = 0;
  // Push oldest first so write order is preserved.
  entries.sort((a, b) => a.queuedAt - b.queuedAt);
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
  })();
  try {
    return await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

let listenersAttached = false;

/** Attach a single global listener that flushes the outbox when we come online. */
export function ensureOutboxAutoFlush(onFlushed?: (r: { ok: number; failed: number }) => void) {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  const handler = async () => {
    if (!navigator.onLine) return;
    try {
      const r = await flushOutbox();
      if (r.ok || r.failed) onFlushed?.(r);
    } catch (err) {
      console.warn('[outbox] flush failed', err);
    }
  };
  window.addEventListener('online', handler);
  // Re-check when the tab becomes visible — laptops often wake without firing 'online'.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void handler();
  });
  // Also flush on startup in case last session ended offline.
  if (navigator.onLine) {
    setTimeout(handler, 1500);
  }
}

/** Test-only: reset module state between tests. */
export function __resetOutboxForTests() {
  dbPromise = null;
  flushInFlight = null;
  listenersAttached = false;
}