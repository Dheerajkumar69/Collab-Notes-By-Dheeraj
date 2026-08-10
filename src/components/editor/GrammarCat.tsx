/**
 * GrammarCat — a little cat that shows up while you type, reads your text with
 * AI, and walks over to each misspelled word to fix it.
 *
 * Behaviour contract:
 *  - The cat NEVER leaves the visible part of the editor. If the flagged word
 *    is scrolled out of view it parks at the bottom-right of the visible area
 *    and asks you to press Tab to jump to the word.
 *  - Tab is two-stage: first Tab scrolls/reveals the flagged word, second Tab
 *    applies the fix (with a ~0.5s pounce). Esc / Skip dismisses.
 *  - Scanning is heavily throttled (long idle window, minimum interval,
 *    minimum text delta, result cache, offline/hidden-tab skip, exponential
 *    backoff on rate limits) so heavy usage never hammers the AI gateway.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';
import { grammarKey, type GrammarItem, type RawSuggestion } from './extensions/GrammarSuggestions';

/** Idle time after the last keystroke before we even consider a scan. */
const IDLE_MS = 3500;
/** Hard floor between two AI calls, regardless of typing. */
const MIN_INTERVAL_MS = 15000;
/** Don't re-scan unless this many characters changed since the last scan. */
const MIN_DELTA_CHARS = 25;
const MIN_CHARS = 12;
const MAX_CHARS = 6000;
const CACHE_LIMIT = 24;
const BASE_COOLDOWN_MS = 45000;
const MAX_COOLDOWN_MS = 10 * 60 * 1000;

interface Props {
  editor: Editor | null;
  enabled?: boolean;
}

/** Cheap character-level distance proxy — enough to gate re-scans. */
function delta(a: string, b: string): number {
  if (a === b) return 0;
  const len = Math.min(a.length, b.length);
  let head = 0;
  while (head < len && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < len - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return Math.max(a.length, b.length) - head - tail;
}

export function GrammarCat({ editor, enabled = true }: Props) {
  const [items, setItems] = useState<GrammarItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pouncing, setPouncing] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const idleTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const pounceTimer = useRef<number | null>(null);
  const lastChecked = useRef('');
  const lastCallAt = useRef(0);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cooldownUntil = useRef(0);
  const cooldownMs = useRef(BASE_COOLDOWN_MS);
  const cache = useRef(new Map<string, RawSuggestion[]>());
  const mounted = useRef(true);

  const active = items[0];
  const activeId = active?.id;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // A new active suggestion always starts "not revealed" → first Tab jumps to it.
  useEffect(() => {
    setRevealed(false);
  }, [activeId]);

  /** Ask the AI brain for corrections. */
  const runCheck = useCallback(async () => {
    if (!editor || editor.isDestroyed || !enabled) return;
    if (inFlight.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const now = Date.now();
    if (now < cooldownUntil.current) return;
    if (now - lastCallAt.current < MIN_INTERVAL_MS) return;

    // Read a window centred on the cursor so long notes still get checked
    // where the writer is actually working.
    let payload = '';
    try {
      const size = editor.state.doc.content.size;
      const cursor = Math.min(editor.state.selection.from, size);
      const half = Math.floor(MAX_CHARS / 2);
      const from = Math.max(0, cursor - half);
      const to = Math.min(size, cursor + half);
      payload = editor.state.doc.textBetween(from, to, '\n', ' ').trim();
    } catch {
      return;
    }
    if (payload.length < MIN_CHARS) return;
    if (delta(payload, lastChecked.current) < MIN_DELTA_CHARS) return;

    // Serve from cache when the writer bounces between the same paragraphs.
    const cached = cache.current.get(payload);
    if (cached) {
      lastChecked.current = payload;
      if (!editor.isDestroyed) editor.commands.setGrammarSuggestions(cached);
      return;
    }

    inFlight.current = true;
    lastCallAt.current = now;
    setThinking(true);
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      const { data, error } = await supabase.functions.invoke('grammar-check', {
        body: { text: payload },
      });
      if (error) throw error;

      const suggestions: RawSuggestion[] = Array.isArray(data?.suggestions)
        ? data.suggestions.filter(
            (s: unknown): s is RawSuggestion =>
              !!s &&
              typeof (s as RawSuggestion).wrong === 'string' &&
              typeof (s as RawSuggestion).fix === 'string',
          )
        : [];

      lastChecked.current = payload;
      cooldownMs.current = BASE_COOLDOWN_MS;
      cache.current.set(payload, suggestions);
      if (cache.current.size > CACHE_LIMIT) {
        const oldest = cache.current.keys().next().value;
        if (oldest !== undefined) cache.current.delete(oldest);
      }
      if (!editor.isDestroyed && mounted.current) editor.commands.setGrammarSuggestions(suggestions);
    } catch (e) {
      // Never surface an error to the writer — the cat just stays quiet and
      // backs off exponentially so a rate limit can't turn into a hot loop.
      if (!controller.signal.aborted) console.warn('grammar-check failed', e);
      cooldownUntil.current = Date.now() + cooldownMs.current;
      cooldownMs.current = Math.min(cooldownMs.current * 2, MAX_COOLDOWN_MS);
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
      inFlight.current = false;
      if (mounted.current) setThinking(false);
    }
  }, [editor, enabled]);

  // Track typing + suggestion state.
  useEffect(() => {
    if (!editor || !enabled) return;

    const onTransaction = () => {
      if (editor.isDestroyed) return;
      const next = grammarKey.getState(editor.state)?.items ?? [];
      setItems((prev) => (prev === next ? prev : next));
    };

    const onUpdate = () => {
      setVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        void runCheck();
      }, IDLE_MS);
    };

    editor.on('transaction', onTransaction);
    editor.on('update', onUpdate);
    onTransaction();
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('update', onUpdate);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (pounceTimer.current) window.clearTimeout(pounceTimer.current);
    };
  }, [editor, enabled, runCheck]);

  // Clear pending work when the feature is switched off / editor swapped.
  useEffect(() => {
    if (enabled) return;
    setItems([]);
    setVisible(false);
    setThinking(false);
  }, [enabled]);

  // Hide the cat when there's nothing to say and typing has stopped.
  useEffect(() => {
    if (!visible || items.length || thinking) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), 2500);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [visible, items.length, thinking]);

  // Position the cat next to the active word — but always inside the part of
  // the editor that is actually on screen.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const container = editor.view.dom.parentElement;
    if (!container) return;

    let raf = 0;
    const place = () => {
      if (!editor || editor.isDestroyed) return;
      const rect = container.getBoundingClientRect();
      const viewTop = Math.max(rect.top, 0);
      const viewBottom = Math.min(rect.bottom, window.innerHeight || rect.bottom);
      // Coordinates relative to the container, clamped to the visible band.
      const minY = Math.max(0, viewTop - rect.top + 8);
      const maxY = Math.max(minY, viewBottom - rect.top - 64);
      const parkY = maxY;

      if (!active) {
        setOffscreen(false);
        setPos(null);
        return;
      }
      try {
        const from = Math.max(0, Math.min(active.from, editor.state.doc.content.size - 1));
        const coords = editor.view.coordsAtPos(from);
        const wordVisible = coords.bottom > viewTop + 4 && coords.top < viewBottom - 4;
        const x = Math.max(4, Math.min(coords.left - rect.left - 18, Math.max(4, rect.width - 300)));
        if (wordVisible) {
          const y = Math.min(Math.max(coords.top - rect.top - 40, minY), maxY);
          setOffscreen(false);
          setPos({ x, y });
        } else {
          setOffscreen(true);
          setPos({ x: Math.max(4, rect.width - 320), y: parkY });
        }
      } catch {
        setOffscreen(true);
        setPos({ x: Math.max(4, rect.width - 320), y: parkY });
      }
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };

    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    container.addEventListener('scroll', schedule, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      container.removeEventListener('scroll', schedule, true);
    };
  }, [editor, active]);

  const reveal = useCallback(() => {
    if (!editor || !active || editor.isDestroyed) return;
    try {
      const size = editor.state.doc.content.size;
      const from = Math.max(0, Math.min(active.from, size));
      const to = Math.max(from, Math.min(active.to, size));
      editor.chain().setTextSelection({ from, to }).scrollIntoView().run();
    } catch {
      /* ignore — the cat just stays put */
    }
    setRevealed(true);
  }, [editor, active]);

  const accept = useCallback(() => {
    if (!editor || !active || pouncing || editor.isDestroyed) return;
    setPouncing(true);
    if (pounceTimer.current) window.clearTimeout(pounceTimer.current);
    pounceTimer.current = window.setTimeout(() => {
      if (editor && !editor.isDestroyed) editor.commands.acceptGrammarSuggestion(active.id);
      if (mounted.current) setPouncing(false);
    }, 320);
  }, [editor, active, pouncing]);

  const dismiss = useCallback(() => {
    if (!editor || !active || editor.isDestroyed) return;
    editor.commands.dismissGrammarSuggestion(active.id);
  }, [editor, active]);

  /** One Tab when the word is on screen; two when it's scrolled out of view. */
  const handleTab = useCallback(() => {
    if (!active) return false;
    if (offscreen && !revealed) {
      reveal();
      return true;
    }
    accept();
    return true;
  }, [active, offscreen, revealed, reveal, accept]);

  // Intercept Tab / Escape before ProseMirror sees them.
  useEffect(() => {
    if (!editor || editor.isDestroyed || !enabled) return;
    const dom = editor.view.dom as HTMLElement;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (handleTab()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (e.key === 'Escape' && items.length) {
        editor.commands.clearGrammarSuggestions();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    dom.addEventListener('keydown', onKeyDown, true);
    return () => dom.removeEventListener('keydown', onKeyDown, true);
  }, [editor, enabled, handleTab, items.length]);

  const hint = useMemo(() => {
    if (!active) return null;
    if (offscreen && !revealed) return 'Tab · go to word';
    return 'Tab · fix';
  }, [active, offscreen, revealed]);

  if (!editor || !enabled) return null;

  const show = visible || items.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="grammar-cat"
          initial={{ opacity: 0, scale: 0.6, y: 8 }}
          animate={
            pos
              ? { opacity: 1, scale: 1, x: pos.x, y: pos.y }
              : { opacity: 1, scale: 1, x: 0, y: 0 }
          }
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.6, duration: 0.45 }}
          className={`pointer-events-none absolute z-30 ${pos ? 'left-0 top-0' : 'right-3 bottom-3'}`}
        >
          <div className="pointer-events-auto flex items-end gap-2">
            <motion.div
              animate={
                pouncing
                  ? { y: [0, -14, 4, 0], rotate: [0, -12, 10, 0], scale: [1, 1.15, 0.95, 1] }
                  : { y: [0, -2, 0] }
              }
              transition={
                pouncing
                  ? { duration: 0.5, ease: 'easeInOut' }
                  : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
              }
              className="select-none text-2xl drop-shadow-md"
              aria-hidden
            >
              🐱
            </motion.div>

            {active ? (
              <div className="max-w-[280px] rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-lg">
                <div className="text-[11px] text-muted-foreground">
                  {offscreen ? 'this one is off screen' : active.reason}
                </div>
                <div className="mt-0.5 text-sm">
                  <span className="line-through text-destructive/80">{active.wrong}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-semibold text-emerald-500">{active.fix}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTab()}
                    className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                  >
                    {offscreen && !revealed ? 'Go · Tab' : 'Fix · Tab'}
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    Skip
                  </button>
                  {items.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">+{items.length - 1} more</span>
                  )}
                </div>
                <div className="sr-only">{hint}</div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-1.5 text-[11px] text-muted-foreground shadow-md">
                {thinking ? 'reading your notes…' : 'looks good to me!'}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
