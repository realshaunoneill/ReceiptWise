/*
 * Just enough Markdown to read the spending summary the model writes: headings, paragraphs,
 * bullet and numbered lists, and bold. The output is plain data rendered as React elements, so
 * nothing the model writes is ever treated as HTML. There is no Markdown renderer in the
 * dependencies, and this one place does not justify adding one.
 */

export type Inline = { text: string; bold?: boolean };

export type Block =
  | { type: 'heading'; content: Inline[] }
  | { type: 'paragraph'; content: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] };

const HEADING = /^#{1,6}\s+(.*)$/;
const BULLET = /^[-*•]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;
// A line that is nothing but bold, "**Where it went:**", is a heading in all but name.
const BOLD_LINE = /^(?:\*\*|__)([^*_]+?)(?:\*\*|__):?$/;

/** Bold runs, with links reduced to their text and stray emphasis or code markers dropped. */
export function parseInline(text: string): Inline[] {
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1');
  const parts: Inline[] = [];
  for (const piece of cleaned.split(/(\*\*[^*]+\*\*|__[^_]+__)/)) {
    if (!piece) continue;
    const bold = /^(\*\*|__)(.*)\1$/.exec(piece);
    if (bold) {
      parts.push({ text: bold[2], bold: true });
    } else {
      const plain = piece.replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, '$1$2');
      if (plain) parts.push({ text: plain });
    }
  }
  return parts;
}

export function parseSummary(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
    if (list) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
      list = null;
    }
  };

  for (const rawLine of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
      continue;
    }

    const heading = HEADING.exec(line) ?? BOLD_LINE.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', content: parseInline(heading[1].replace(/:$/, '')) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      const ordered = !!numbered;
      if (paragraph.length > 0 || (list && list.ordered !== ordered)) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push(item[1]);
      continue;
    }

    if (list) {
      // An indented line under a list item continues that item; anything else ends the list.
      if (/^\s/.test(rawLine)) {
        list.items[list.items.length - 1] += ` ${line}`;
        continue;
      }
      flush();
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}
