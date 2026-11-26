import type { DiffLine, PrReviewThread } from '@pr-manager/contracts';
import { anchorOf, lineKeysOf, type CommentAnchor, type FileThreads } from './review-threads.store';

/** A rendered code line with what hangs under it: threads and, maybe, the open comment box. */
export interface LineRow {
  kind: 'line';
  /** Index into the view's lines; stable for one view. */
  index: number;
  line: DiffLine;
  anchor: CommentAnchor | null;
  threads: PrReviewThread[];
  draftOpen: boolean;
}

/** A collapsed run of unchanged lines, expandable by `start`. */
export interface GapRow {
  kind: 'gap';
  start: number;
  count: number;
}

export type ViewRow = LineRow | GapRow;

/** Unchanged lines kept visible around changes and comments. */
export const GAP_CONTEXT = 8;
/** Shorter unchanged runs aren't worth collapsing. */
export const MIN_GAP = 20;

/**
 * One row per line, with each thread hung under its line. A thread whose line isn't rendered
 * (outdated, or only hunks are shown) goes under the nearest earlier line on its side, so it still
 * sits roughly where it was written rather than at the top.
 */
export function buildLineRows(
  path: string,
  lines: readonly DiffLine[],
  threads: FileThreads | undefined,
  draft: CommentAnchor | null,
): LineRow[] {
  const rows: LineRow[] = lines.map((line, index) => {
    const anchor = line.commentable ? anchorOf(path, line) : null;
    const draftOpen = !!draft && !!anchor && draft.path === path && draft.side === anchor.side && draft.line === anchor.line;
    return { kind: 'line', index, line, anchor, threads: [], draftOpen };
  });
  if (!threads || !rows.length) {
    return rows;
  }

  const indexByKey = new Map<string, number>();
  rows.forEach((row, i) => lineKeysOf(row.line).forEach((key) => indexByKey.has(key) || indexByKey.set(key, i)));

  for (const [key, keyThreads] of threads.byLine) {
    const i = indexByKey.get(key) ?? nearestRow(rows, key);
    rows[i].threads.push(...keyThreads);
  }
  return rows;
}

/** Last row at or before `line` on the key's side; the first row when the line is before everything. */
function nearestRow(rows: readonly LineRow[], key: string): number {
  const [side, raw] = key.split(':');
  const target = Number(raw);
  let best = 0;
  rows.forEach((row, i) => {
    const n = side === 'LEFT' ? row.line.oldLine : row.line.newLine;
    if (n !== null && n <= target) {
      best = i;
    }
  });
  return best;
}

/**
 * Collapses long runs of unchanged lines (no change, thread or comment box), keeping `GAP_CONTEXT`
 * lines on each side, so big files with small changes render fast. `expanded` holds gap starts
 * the user opened.
 */
export function collapseUnchanged(rows: readonly LineRow[], expanded: ReadonlySet<number>): ViewRow[] {
  const quiet = (r: LineRow) => r.line.type === 'context' && !r.threads.length && !r.draftOpen;
  const out: ViewRow[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!quiet(rows[i])) {
      out.push(rows[i++]);
      continue;
    }
    let end = i;
    while (end < rows.length && quiet(rows[end])) {
      end++;
    }
    const hideFrom = i === 0 ? 0 : i + GAP_CONTEXT;
    const hideTo = end === rows.length ? end : end - GAP_CONTEXT;
    if (hideTo - hideFrom >= MIN_GAP && !expanded.has(hideFrom)) {
      out.push(...rows.slice(i, hideFrom), { kind: 'gap', start: hideFrom, count: hideTo - hideFrom }, ...rows.slice(hideTo, end));
    } else {
      out.push(...rows.slice(i, end));
    }
    i = end;
  }
  return out;
}
