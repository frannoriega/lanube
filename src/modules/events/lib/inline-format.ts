/**
 * Minimal **inline-only** rich-text used for the event `summary` (the blurb shown on landing /
 * event cards). It deliberately supports just three marks — **bold**, _italic_ and ++underline++
 * — and no block syntax (no headings, lists, links, images). The delimiters are inserted by the
 * summary editor's toolbar, so authors never type them by hand.
 *
 * The parser produces a plain tree of nodes; the renderer (`<InlineRichText>`) turns them into
 * `<strong>` / `<em>` / `<u>` elements. Because the output is React text + elements (never raw
 * HTML), there is no injection vector even though summaries are shown publicly. Unbalanced or
 * stray delimiters are rendered as literal characters, so any input is safe and lossless.
 */

export type InlineMark = "bold" | "italic" | "underline";

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "mark"; mark: InlineMark; children: InlineNode[] };

interface Delimiter {
  token: string;
  mark: InlineMark;
}

// Order matters: longer tokens are tried first so "**" is not mistaken for two "*"-style marks.
const DELIMITERS: Delimiter[] = [
  { token: "**", mark: "bold" },
  { token: "++", mark: "underline" },
  { token: "_", mark: "italic" },
];

/** Character delimiters used by the editor toolbar (kept in sync with DELIMITERS). */
export const INLINE_DELIMITERS: Record<InlineMark, string> = {
  bold: "**",
  underline: "++",
  italic: "_",
};

/**
 * Parses `input` into an inline node tree. Marks may nest (e.g. bold containing italic). Any
 * delimiter without a matching partner is emitted as literal text.
 */
export function parseInlineMarks(input: string): InlineNode[] {
  if (!input) return [];

  // Find the earliest delimiter that has a matching closing token later in the string.
  let best: { index: number; delim: Delimiter; close: number } | null = null;

  for (const delim of DELIMITERS) {
    const open = input.indexOf(delim.token);
    if (open === -1) continue;
    const close = input.indexOf(delim.token, open + delim.token.length);
    if (close === -1) continue; // no partner → not a real mark
    if (best === null || open < best.index) {
      best = { index: open, delim, close };
    }
  }

  if (best === null) {
    return [{ type: "text", value: input }];
  }

  const { index, delim, close } = best;
  const nodes: InlineNode[] = [];

  if (index > 0) {
    nodes.push({ type: "text", value: input.slice(0, index) });
  }

  const innerRaw = input.slice(index + delim.token.length, close);
  const inner = innerRaw
    ? parseInlineMarks(innerRaw)
    : [{ type: "text" as const, value: "" }];
  nodes.push({ type: "mark", mark: delim.mark, children: inner });

  const rest = input.slice(close + delim.token.length);
  if (rest) {
    nodes.push(...parseInlineMarks(rest));
  }

  return nodes;
}

/** Strips all inline marks, returning the plain-text content (for lengths, previews, aria). */
export function stripInlineMarks(input: string): string {
  const walk = (nodes: InlineNode[]): string =>
    nodes.map((n) => (n.type === "text" ? n.value : walk(n.children))).join("");
  return walk(parseInlineMarks(input));
}
