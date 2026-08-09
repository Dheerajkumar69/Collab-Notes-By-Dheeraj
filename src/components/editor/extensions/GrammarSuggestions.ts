/**
 * GrammarSuggestions — AI-backed spelling/grammar decorations.
 *
 * The extension only *renders and applies* suggestions; the AI call lives in
 * the React layer (GrammarCat) which pushes results in via the
 * `setGrammarSuggestions` command.
 *
 * Robustness notes:
 *  - Positions are mapped through every transaction (Yjs remote edits included).
 *  - An item is dropped the moment the text at its range stops matching the
 *    original word, so a stale suggestion can never rewrite the wrong text.
 *  - Accepting is a single transaction → one Ctrl-Z restores the original.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';

export interface GrammarItem {
  id: string;
  from: number;
  to: number;
  wrong: string;
  fix: string;
  reason: string;
}

export interface RawSuggestion {
  wrong: string;
  fix: string;
  reason?: string;
}

interface GrammarPluginState {
  items: GrammarItem[];
  decos: DecorationSet;
}

export const grammarKey = new PluginKey<GrammarPluginState>('grammarSuggestions');

const SKIP_NODES = new Set(['codeBlock', 'drawing']);

/** Collect every word occurrence in the doc with its absolute positions. */
function collectWords(state: EditorState) {
  const out: { word: string; from: number; to: number }[] = [];
  state.doc.descendants((node, pos, parent) => {
    if (parent && SKIP_NODES.has(parent.type.name)) return false;
    if (SKIP_NODES.has(node.type.name)) return false;
    if (!node.isText || !node.text) return;
    if (node.marks.some((m) => m.type.name === 'code' || m.type.name === 'link')) return;
    const re = /[A-Za-z][A-Za-z'’-]*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text)) !== null) {
      out.push({ word: m[0], from: pos + m.index, to: pos + m.index + m[0].length });
    }
  });
  return out;
}

function buildItems(state: EditorState, raw: RawSuggestion[]): GrammarItem[] {
  const words = collectWords(state);
  const items: GrammarItem[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    const target = s.wrong.trim();
    if (!target) continue;
    for (const w of words) {
      if (w.word.toLowerCase() !== target.toLowerCase()) continue;
      const key = `${w.from}:${w.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `${key}:${s.fix}`,
        from: w.from,
        to: w.to,
        wrong: w.word,
        fix: matchCase(w.word, s.fix.trim()),
        reason: s.reason?.trim() || 'Spelling',
      });
    }
  }
  return items.sort((a, b) => a.from - b.from).slice(0, 40);
}

function matchCase(source: string, target: string): string {
  if (source.length > 1 && source === source.toUpperCase()) return target.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return target[0].toUpperCase() + target.slice(1);
  return target;
}

function decorate(items: GrammarItem[], state: EditorState): DecorationSet {
  if (!items.length) return DecorationSet.empty;
  const decos = items.map((it, i) =>
    Decoration.inline(it.from, it.to, {
      class: i === 0 ? 'grammar-error grammar-error--active' : 'grammar-error',
      'data-grammar-id': it.id,
    }),
  );
  return DecorationSet.create(state.doc, decos);
}

/** Keep only items whose text still matches, remapping through the transaction. */
function remap(items: GrammarItem[], tr: Transaction): GrammarItem[] {
  const next: GrammarItem[] = [];
  for (const it of items) {
    const from = tr.mapping.map(it.from, 1);
    const to = tr.mapping.map(it.to, -1);
    if (to <= from) continue;
    let text = '';
    try {
      text = tr.doc.textBetween(from, to, '', '');
    } catch {
      continue;
    }
    if (text !== it.wrong) continue;
    next.push({ ...it, from, to });
  }
  return next;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    grammarSuggestions: {
      setGrammarSuggestions: (suggestions: RawSuggestion[]) => ReturnType;
      clearGrammarSuggestions: () => ReturnType;
      acceptGrammarSuggestion: (id?: string) => ReturnType;
      dismissGrammarSuggestion: (id?: string) => ReturnType;
    };
  }
}

export interface GrammarOptions {
  enabled: boolean;
  onItemsChange?: (items: GrammarItem[]) => void;
}

export const GrammarSuggestions = Extension.create<GrammarOptions>({
  name: 'grammarSuggestions',

  addOptions() {
    return { enabled: true, onItemsChange: undefined };
  },

  addCommands() {
    return {
      setGrammarSuggestions:
        (suggestions) =>
        ({ state, dispatch }) => {
          if (dispatch) dispatch(state.tr.setMeta(grammarKey, { type: 'set', suggestions }));
          return true;
        },
      clearGrammarSuggestions:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) dispatch(state.tr.setMeta(grammarKey, { type: 'clear' }));
          return true;
        },
      dismissGrammarSuggestion:
        (id) =>
        ({ state, dispatch }) => {
          const items = grammarKey.getState(state)?.items ?? [];
          const item = id ? items.find((i) => i.id === id) : items[0];
          if (!item) return false;
          if (dispatch) dispatch(state.tr.setMeta(grammarKey, { type: 'dismiss', id: item.id }));
          return true;
        },
      acceptGrammarSuggestion:
        (id) =>
        ({ state, dispatch }) => {
          const items = grammarKey.getState(state)?.items ?? [];
          const item = id ? items.find((i) => i.id === id) : items[0];
          if (!item) return false;
          // Guard: never rewrite text that has drifted.
          let current = '';
          try {
            current = state.doc.textBetween(item.from, item.to, '', '');
          } catch {
            return false;
          }
          if (current !== item.wrong) return false;
          if (dispatch) {
            const tr = state.tr
              .insertText(item.fix, item.from, item.to)
              .setMeta(grammarKey, { type: 'dismiss', id: item.id })
              .setMeta('addToHistory', true);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const items = grammarKey.getState(this.editor.state)?.items ?? [];
        if (!items.length) return false;
        return this.editor.commands.acceptGrammarSuggestion();
      },
      Escape: () => {
        const items = grammarKey.getState(this.editor.state)?.items ?? [];
        if (!items.length) return false;
        return this.editor.commands.clearGrammarSuggestions();
      },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<GrammarPluginState>({
        key: grammarKey,
        state: {
          init: () => ({ items: [], decos: DecorationSet.empty }),
          apply(tr, value, _old, newState) {
            const meta = tr.getMeta(grammarKey) as
              | { type: 'set'; suggestions: RawSuggestion[] }
              | { type: 'clear' }
              | { type: 'dismiss'; id: string }
              | undefined;

            let items = value.items;

            if (tr.docChanged) items = remap(items, tr);

            if (meta?.type === 'clear') items = [];
            else if (meta?.type === 'dismiss') items = items.filter((i) => i.id !== meta.id);
            else if (meta?.type === 'set') {
              items = options.enabled ? buildItems(newState, meta.suggestions) : [];
            }

            if (items === value.items && !tr.docChanged && !meta) return value;
            return { items, decos: decorate(items, newState) };
          },
        },
        props: {
          decorations: (state) => grammarKey.getState(state)?.decos ?? DecorationSet.empty,
        },
        view: () => ({
          update: (view, prevState) => {
            const prev = grammarKey.getState(prevState)?.items ?? [];
            const next = grammarKey.getState(view.state)?.items ?? [];
            if (prev !== next) options.onItemsChange?.(next);
          },
        }),
      }),
    ];
  },
});