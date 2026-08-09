/**
 * GrammarCat — a little cat that shows up while you type, reads your text with
 * AI, and walks over to each misspelled word to fix it.
 *
 * Flow: typing → 1.2s idle → edge function `grammar-check` → decorations +
 * cat hops to the first flagged word. Tab (or the Fix button) accepts,
 * the cat pounces (~0.5s) and the word is corrected. Esc / ✕ dismisses.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { supabase } from '@/integrations/supabase/client';
import { grammarKey, type GrammarItem } from './extensions/GrammarSuggestions';

const IDLE_MS = 1200;
const MIN_CHARS = 12;
const MAX_CHARS = 6000;

interface Props {
  editor: Editor | null;
  enabled?: boolean;
}

export function GrammarCat({ editor, enabled = true }: Props) {
  const [items, setItems] = useState<GrammarItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pouncing, setPouncing] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const idleTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const lastChecked = useRef('');
  const inFlight = useRef(false);
  const cooldownUntil = useRef(0);

  const active = items[0];

  /** Ask the AI brain for corrections. */
  const runCheck = useCallback(async () => {
    if (!editor || editor.isDestroyed || !enabled) return;
    if (inFlight.current || Date.now() < cooldownUntil.current) return;

    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', ' ').trim();
    if (text.length < MIN_CHARS) return;
    const payload = text.slice(-MAX_CHARS);
    if (payload === lastChecked.current) return;

    inFlight.current = true;
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('grammar-check', {
        body: { text: payload },
      });
      if (error) throw error;
      lastChecked.current = payload;
      const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      if (editor.isDestroyed) return;
      editor.commands.setGrammarSuggestions(suggestions);
    } catch (e) {
      // Never surface an error to the writer — the cat just stays quiet.
      console.warn('grammar-check failed', e);
      cooldownUntil.current = Date.now() + 30_000;
    } finally {
      inFlight.current = false;
      setThinking(false);
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
      idleTimer.current = window.setTimeout(runCheck, IDLE_MS);
    };

    editor.on('transaction', onTransaction);
    editor.on('update', onUpdate);
    return () => {
      editor.off('transaction', onTransaction);
      editor.off('update', onUpdate);
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [editor, enabled, runCheck]);

  // Hide the cat when there's nothing to say and typing has stopped.
  useEffect(() => {
    if (!visible || items.length || thinking) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), 2500);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [visible, items.length, thinking]);

  // Position the cat next to the active word (or park it bottom-right).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const container = editor.view.dom.parentElement;
    if (!container) return;

    const place = () => {
      if (!editor || editor.isDestroyed) return;
      const rect = container.getBoundingClientRect();
      if (!active) {
        setPos(null);
        return;
      }
      try {
        const coords = editor.view.coordsAtPos(Math.min(active.from, editor.state.doc.content.size - 1));
        const x = Math.max(4, Math.min(coords.left - rect.left - 18, rect.width - 44));
        const y = Math.max(0, coords.top - rect.top - 40);
        setPos({ x, y });
      } catch {
        setPos(null);
      }
    };

    place();
    window.addEventListener('resize', place);
    container.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      container.removeEventListener('scroll', place, true);
    };
  }, [editor, active]);

  const accept = useCallback(() => {
    if (!editor || !active || pouncing) return;
    setPouncing(true);
    window.setTimeout(() => {
      if (!editor.isDestroyed) editor.commands.acceptGrammarSuggestion(active.id);
      setPouncing(false);
    }, 320);
  }, [editor, active, pouncing]);

  const dismiss = useCallback(() => {
    if (!editor || !active) return;
    editor.commands.dismissGrammarSuggestion(active.id);
  }, [editor, active]);

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
                <div className="text-[11px] text-muted-foreground">{active.reason}</div>
                <div className="mt-0.5 text-sm">
                  <span className="line-through text-destructive/80">{active.wrong}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-semibold text-emerald-500">{active.fix}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={accept}
                    className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                  >
                    Fix · Tab
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