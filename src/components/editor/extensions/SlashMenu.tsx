/**
 * SlashMenu — Tiptap suggestion-driven block command palette.
 *
 * Type "/" anywhere in the editor and a tippy popover lists all block
 * commands, filtered by what you type after the slash. Arrow keys / enter
 * select. Esc closes.
 */
import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote,
  Code as CodeIcon, Minus, Image as ImageIcon, Table as TableIcon,
  Lightbulb, CheckCircle2, AlertTriangle, Octagon,
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Editor, Range } from '@tiptap/core';

export interface SlashItem {
  title: string;
  description?: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  command: (props: { editor: Editor; range: Range }) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    title: 'Heading 1', keywords: ['h1', 'title', 'heading'], icon: Heading1,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2', keywords: ['h2', 'subtitle'], icon: Heading2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3', keywords: ['h3'], icon: Heading3,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Bullet list', keywords: ['ul', 'unordered', 'list', 'bullet'], icon: List,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered list', keywords: ['ol', 'ordered', 'numbered'], icon: ListOrdered,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Task list', keywords: ['todo', 'task', 'checkbox'], icon: ListChecks,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Quote', keywords: ['blockquote', 'quote'], icon: Quote,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code block', keywords: ['code', 'pre', 'snippet'], icon: CodeIcon,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider', keywords: ['hr', 'rule', 'divider', 'separator'], icon: Minus,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Table', keywords: ['table', 'grid'], icon: TableIcon,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range)
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Image', keywords: ['image', 'img', 'picture'], icon: ImageIcon,
    command: ({ editor, range }) => {
      const url = window.prompt('Image URL');
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      } else {
        editor.chain().focus().deleteRange(range).run();
      }
    },
  },
  {
    title: 'Info callout', keywords: ['callout', 'info', 'note', 'tip'], icon: Lightbulb,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range)
      .setCallout({ variant: 'info' }).run(),
  },
  {
    title: 'Success callout', keywords: ['success', 'callout', 'good'], icon: CheckCircle2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range)
      .setCallout({ variant: 'success' }).run(),
  },
  {
    title: 'Warning callout', keywords: ['warn', 'callout', 'caution'], icon: AlertTriangle,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range)
      .setCallout({ variant: 'warn' }).run(),
  },
  {
    title: 'Danger callout', keywords: ['danger', 'callout', 'error', 'stop'], icon: Octagon,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range)
      .setCallout({ variant: 'danger' }).run(),
  },
];

function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(it =>
    it.title.toLowerCase().includes(q) || it.keywords.some(k => k.includes(q))
  );
}

interface ListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export const SlashList = forwardRef<{ onKeyDown: (e: { event: KeyboardEvent }) => boolean }, ListProps>(
  function SlashList(props, ref) {
    const [selected, setSelected] = useState(0);
    useEffect(() => setSelected(0), [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelected(s => (s + props.items.length - 1) % Math.max(props.items.length, 1));
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelected(s => (s + 1) % Math.max(props.items.length, 1));
          return true;
        }
        if (event.key === 'Enter') {
          const item = props.items[selected];
          if (item) props.command(item);
          return true;
        }
        return false;
      },
    }));

    if (!props.items.length) {
      return (
        <div className="z-50 max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl text-popover-foreground">
          <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
        </div>
      );
    }

    return (
      <div className="z-50 max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl text-popover-foreground">
        {props.items.map((item, i) => (
          <button
            key={item.title}
            type="button"
            onClick={() => props.command(item)}
            onMouseEnter={() => setSelected(i)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              i === selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>
    );
  }
);

export const SlashCommands = Extension.create({
  name: 'slashCommands',
  addOptions(): { suggestion: Omit<SuggestionOptions, 'editor'> } {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          (props as SlashItem).command({ editor, range });
        },
        items: ({ query }) => filterItems(query),
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance | null = null;
          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashList, { props, editor: props.editor });
              if (!props.clientRect) return;
              popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate: (props) => {
              component?.updateProps(props);
              if (props.clientRect && popup) {
                popup.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
              }
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.hide();
                return true;
              }
              const ref = component?.ref as { onKeyDown?: (p: { event: KeyboardEvent }) => boolean } | null;
              return ref?.onKeyDown?.({ event: props.event }) ?? false;
            },
            onExit: () => {
              popup?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({ editor: this.editor, ...(this.options.suggestion as SuggestionOptions) }),
    ];
  },
});