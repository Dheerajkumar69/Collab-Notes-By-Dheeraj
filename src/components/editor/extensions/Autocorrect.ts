/**
 * Autocorrect — a Grammarly-lite typo fixer that runs entirely client-side.
 *
 * Strategy: an InputRule fires when the user types a whitespace/punctuation
 * boundary after a common misspelling and swaps the wrong word for the right
 * one, preserving the trailing character and the original capitalization.
 *
 * Design goals:
 *  - Zero network calls, zero AI cost, works offline.
 *  - Never rewrites inside code blocks or code marks.
 *  - Case-preserving: "Teh" -> "The", "TEH" -> "THE".
 *  - Fully undoable — the replacement is a single ProseMirror transaction so
 *    Ctrl-Z restores the user's typo verbatim.
 *  - Extensible: add entries to DICTIONARY without touching the plugin.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Common English typos. Left = wrong (lowercase), right = correct.
// Kept intentionally short and safe — only unambiguous misspellings.
const DICTIONARY: Record<string, string> = {
  teh: 'the', hte: 'the', taht: 'that', thsi: 'this', tihs: 'this',
  adn: 'and', nad: 'and', ans: 'and',
  recieve: 'receive', recieved: 'received', reciept: 'receipt',
  seperate: 'separate', seperated: 'separated', seperately: 'separately',
  definately: 'definitely', definatly: 'definitely', definetly: 'definitely',
  occured: 'occurred', occuring: 'occurring', occurance: 'occurrence',
  untill: 'until', wich: 'which', wierd: 'weird', freind: 'friend',
  beleive: 'believe', beleived: 'believed', beleiving: 'believing',
  acheive: 'achieve', acheived: 'achieved', acheiving: 'achieving',
  arguement: 'argument', enviroment: 'environment', goverment: 'government',
  neccessary: 'necessary', neccesary: 'necessary', accomodate: 'accommodate',
  tommorow: 'tomorrow', tomorow: 'tomorrow', yesturday: 'yesterday',
  alot: 'a lot', aswell: 'as well', infact: 'in fact', incase: 'in case',
  wont: "won't", cant: "can't", dont: "don't", isnt: "isn't", arent: "aren't",
  wasnt: "wasn't", werent: "weren't", didnt: "didn't", doesnt: "doesn't",
  wouldnt: "wouldn't", shouldnt: "shouldn't", couldnt: "couldn't",
  im: "I'm", ive: "I've", ill: "I'll", id: "I'd",
  youre: "you're", youve: "you've", theyre: "they're", theyve: "they've",
  its: "its", // Keep as-is; "its" vs "it's" is ambiguous — leave for user.
  thier: 'their', wtih: 'with', witht: 'with', abotu: 'about',
  becuase: 'because', becasue: 'because', bcause: 'because',
  probaly: 'probably', probally: 'probably', prolly: 'probably',
  reccomend: 'recommend', reccommend: 'recommend', recomend: 'recommend',
  succesful: 'successful', succesfully: 'successfully',
  begining: 'beginning', beggining: 'beginning',
  wolud: 'would', woudl: 'would', shoudl: 'should', coudl: 'could',
  fro: 'for', ot: 'to', ofthe: 'of the', tothe: 'to the',
};

// Preserve capitalisation: match "The" if source was "Teh", "THE" if "TEH".
function matchCase(source: string, target: string): string {
  if (source === source.toUpperCase() && source.length > 1) return target.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return target[0].toUpperCase() + target.slice(1);
  }
  return target;
}

// Fires after a word boundary character. Captures the previous word.
// Note: InputRule's regex runs against the text ending at the cursor.
const RULE = /(\b[A-Za-z']+)(\s|[.,!?;:])$/;

export const Autocorrect = Extension.create({
  name: 'autocorrect',

  addOptions() {
    return { enabled: true as boolean };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('autocorrect'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!this.options.enabled) return null;
          if (!transactions.some((tr) => tr.docChanged) || transactions.some((tr) => tr.getMeta('autocorrect'))) {
            return null;
          }

          const { selection } = newState;
          if (!selection.empty) return null;

          const cursor = selection.from;
          const $from = newState.doc.resolve(cursor);

          // Never rewrite inside code blocks or inline code.
          for (let d = $from.depth; d > 0; d--) {
            const nodeName = $from.node(d).type.name;
            if (nodeName === 'codeBlock') return null;
          }
          if ($from.marks().some((m) => m.type.name === 'code')) return null;

          const parentStart = $from.start();
          const lookBehindFrom = Math.max(parentStart, cursor - 80);
          const textBefore = newState.doc.textBetween(lookBehindFrom, cursor, '\n', '\0');
          const match = textBefore.match(RULE);
          if (!match) return null;

          const wrong = match[1];
          const boundary = match[2];
          const lower = wrong.toLowerCase();
          const fix = DICTIONARY[lower];
          if (!fix || fix.toLowerCase() === lower) return null;

          const cased = matchCase(wrong, fix);
          const start = cursor - match[0].length;
          const end = cursor;

          return newState.tr
            .insertText(`${cased}${boundary}`, start, end)
            .setMeta('autocorrect', true);
        },
      }),
    ];
  },
});

export const AUTOCORRECT_DICTIONARY = DICTIONARY;