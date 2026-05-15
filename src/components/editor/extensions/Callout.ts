/**
 * Callout — a styled block container with an emoji and 4 color variants
 * (info / success / warn / danger). Renders as <div data-callout> so the
 * editor's CSS can theme it. Block content is the standard ProseMirror
 * "block+" so users can put paragraphs, lists, headings inside.
 */
import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutVariant = 'info' | 'success' | 'warn' | 'danger';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { variant?: CalloutVariant; emoji?: string }) => ReturnType;
      toggleCallout: (attrs?: { variant?: CalloutVariant; emoji?: string }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

const VARIANT_EMOJI: Record<CalloutVariant, string> = {
  info: '💡',
  success: '✅',
  warn: '⚠️',
  danger: '🛑',
};

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      variant: {
        default: 'info' as CalloutVariant,
        parseHTML: el => (el.getAttribute('data-variant') as CalloutVariant) || 'info',
        renderHTML: attrs => ({ 'data-variant': attrs.variant }),
      },
      emoji: {
        default: '💡',
        parseHTML: el => el.getAttribute('data-emoji') || VARIANT_EMOJI[(el.getAttribute('data-variant') as CalloutVariant) || 'info'],
        renderHTML: attrs => ({ 'data-emoji': attrs.emoji }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addCommands() {
    return {
      setCallout: (attrs) => ({ commands }) => {
        const variant = (attrs?.variant ?? 'info') as CalloutVariant;
        const emoji = attrs?.emoji ?? VARIANT_EMOJI[variant];
        return commands.wrapIn(this.name, { variant, emoji });
      },
      toggleCallout: (attrs) => ({ commands }) => {
        const variant = (attrs?.variant ?? 'info') as CalloutVariant;
        const emoji = attrs?.emoji ?? VARIANT_EMOJI[variant];
        return commands.toggleWrap(this.name, { variant, emoji });
      },
      unsetCallout: () => ({ commands }) => commands.lift(this.name),
    };
  },
});

export const CALLOUT_VARIANT_EMOJI = VARIANT_EMOJI;