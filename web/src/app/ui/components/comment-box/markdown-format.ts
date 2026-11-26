export type MarkdownFormat = 'bold' | 'italic' | 'code' | 'link' | 'bullets' | 'numbers' | 'tasks';

export interface TextEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

const WRAPS: Partial<Record<MarkdownFormat, [string, string, string]>> = {
  // [before, after, placeholder when nothing is selected]
  bold: ['**', '**', 'bold text'],
  italic: ['_', '_', 'italic text'],
  code: ['`', '`', 'code'],
  link: ['[', '](url)', 'link text'],
};

const LINE_PREFIXES: Partial<Record<MarkdownFormat, (i: number) => string>> = {
  bullets: () => '- ',
  numbers: (i) => `${i + 1}. `,
  tasks: () => '- [ ] ',
};

/** Applies a toolbar format to the selection, ADO / GitHub style. Multi-line code selections become a fenced block. */
export function applyMarkdown(text: string, start: number, end: number, format: MarkdownFormat): TextEdit {
  const selected = text.slice(start, end);

  const prefix = LINE_PREFIXES[format];
  if (prefix) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const block = text.slice(lineStart, end);
    const formatted = block
      .split('\n')
      .map((line, i) => prefix(i) + line)
      .join('\n');
    const next = text.slice(0, lineStart) + formatted + text.slice(end);
    return { text: next, selectionStart: lineStart + formatted.length, selectionEnd: lineStart + formatted.length };
  }

  let [before, after, placeholder] = WRAPS[format] ?? ['', '', ''];
  if (format === 'code' && selected.includes('\n')) {
    [before, after] = ['```\n', '\n```'];
  }
  const inner = selected || placeholder;
  const next = text.slice(0, start) + before + inner + after + text.slice(end);
  // Leave the inserted text (or placeholder) selected so typing replaces it.
  return { text: next, selectionStart: start + before.length, selectionEnd: start + before.length + inner.length };
}
