import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { ApiError, CommentSide, DiffLine, NewReviewComment, PrReviewThread } from '@pr-manager/contracts';
import { firstValueFrom, type Observable } from 'rxjs';
import { toApiError } from '../data-access/api-error';
import { ReviewApi } from '../data-access/review.api';
import { PrDetailStore, type StatusLine } from './pr-detail.store';

/** Where a new comment is being written: a line on one side of one file. */
export interface CommentAnchor {
  path: string;
  side: CommentSide;
  line: number;
}

export interface FileThreads {
  /** Threads by `lineKey(side, line)`. */
  byLine: Map<string, PrReviewThread[]>;
  /** Threads GitHub gives no line for at all (rare); outdated ones keep their original line. */
  unplaced: PrReviewThread[];
}

/** The `posting` value while a thread's status is changing. */
export const statusKey = (threadId: string): string => `status:${threadId}`;

export const lineKey =(side: CommentSide, line: number): string => `${side}:${line}`;

/** The anchor a comment on this diff line gets: deleted lines are on the base (LEFT), the rest on the head (RIGHT). */
export function anchorOf(path: string, line: DiffLine): CommentAnchor | null {
  if (line.type === 'del' && line.oldLine !== null) {
    return { path, side: 'LEFT', line: line.oldLine };
  }
  if (line.type !== 'hunk' && line.newLine !== null) {
    return { path, side: 'RIGHT', line: line.newLine };
  }
  return null;
}

/** Thread keys a rendered line shows: its own anchor, plus base-side threads on unchanged lines. */
export function lineKeysOf(line: DiffLine): string[] {
  if (line.type === 'hunk') {
    return [];
  }
  if (line.type === 'del') {
    return line.oldLine !== null ? [lineKey('LEFT', line.oldLine)] : [];
  }
  const keys = line.newLine !== null ? [lineKey('RIGHT', line.newLine)] : [];
  if (line.type === 'context' && line.oldLine !== null) {
    keys.push(lineKey('LEFT', line.oldLine));
  }
  return keys;
}

export function groupThreads(threads: readonly PrReviewThread[]): Map<string, FileThreads> {
  const byPath = new Map<string, FileThreads>();
  for (const thread of threads) {
    let file = byPath.get(thread.path);
    if (!file) {
      file = { byLine: new Map(), unplaced: [] };
      byPath.set(thread.path, file);
    }
    if (thread.line === null) {
      file.unplaced.push(thread);
    } else {
      const key = lineKey(thread.side, thread.line);
      file.byLine.set(key, [...(file.byLine.get(key) ?? []), thread]);
    }
  }
  return byPath;
}

export type ThreadFilter = 'all' | 'active' | 'resolved';

/** The Overview's "Comments" status row. */
export function commentStatusLine(threads: readonly PrReviewThread[], error: ApiError | null): StatusLine {
  if (error) {
    return { state: 'NONE', title: 'Comments unavailable', subtitle: error.message };
  }
  if (!threads.length) {
    // Nothing to resolve, so the comment requirement is met.
    return { state: 'SUCCESS', title: 'No comments' };
  }
  const resolved = threads.filter((t) => t.isResolved).length;
  const subtitle = `${resolved} of ${threads.length} resolved`;
  if (resolved === threads.length) {
    return { state: 'SUCCESS', title: 'All comments resolved', subtitle };
  }
  const active = threads.length - resolved;
  return { state: 'FAILURE', title: `${active} active comment${active === 1 ? '' : 's'}`, subtitle };
}

export function filterThreads(threads: readonly PrReviewThread[], filter: ThreadFilter): PrReviewThread[] {
  return filter === 'all' ? [...threads] : threads.filter((t) => t.isResolved === (filter === 'resolved'));
}

/**
 * Review threads for the Files Changed and Overview tabs. Provided by each tab, so threads load fresh
 * each time it opens. Posting, resolving and reactivating are real GitHub writes as the token's user.
 */
@Injectable()
export class ReviewThreadsStore {
  private readonly api = inject(ReviewApi);
  private readonly detail = inject(PrDetailStore);

  private readonly resource = rxResource({
    params: () => this.detail.key() ?? undefined,
    stream: ({ params }) => this.api.threads(params),
  });

  readonly threads = computed(() => (this.resource.hasValue() ? this.resource.value() : []));
  readonly error = computed(() => (this.resource.error() ? toApiError(this.resource.error()) : null));
  readonly byPath = computed(() => groupThreads(this.threads()));
  /** Comment count per file, for the tree. */
  readonly countByPath = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.threads()) {
      counts.set(t.path, (counts.get(t.path) ?? 0) + t.comments.length);
    }
    return counts;
  });

  readonly statusLine = computed(() => commentStatusLine(this.threads(), this.error()));
  readonly filter = signal<ThreadFilter>('all');
  readonly filtered = computed(() => filterThreads(this.threads(), this.filter()));
  readonly counts = computed(() => {
    const resolved = this.threads().filter((t) => t.isResolved).length;
    return { all: this.threads().length, active: this.threads().length - resolved, resolved };
  });

  /** The open "new comment" box, if any. One at a time. */
  readonly draft = signal<CommentAnchor | null>(null);
  /** Thread id whose reply box is open. */
  readonly replyingTo = signal<string | null>(null);
  /** What is being posted: 'new' for a new thread, or the thread id for a reply. */
  readonly posting = signal<string | null>(null);
  readonly postError = signal<ApiError | null>(null);
  /** What the last post was for (same values as `posting`), so a failure shows on the right thread. */
  readonly lastAction = signal<string | null>(null);

  /** The status error to show on this thread, if its last Resolve / Reactivate failed. */
  statusErrorFor(threadId: string): string | null {
    return this.lastAction() === statusKey(threadId) ? (this.postError()?.message ?? null) : null;
  }

  reload(): void {
    this.resource.reload();
  }

  openDraft(anchor: CommentAnchor): void {
    this.replyingTo.set(null);
    this.postError.set(null);
    this.draft.set(anchor);
  }

  openReply(threadId: string): void {
    this.draft.set(null);
    this.postError.set(null);
    this.replyingTo.set(threadId);
  }

  cancel(): void {
    this.draft.set(null);
    this.replyingTo.set(null);
    this.postError.set(null);
  }

  /** Starts a thread at the open draft. Resolves true when posted. */
  comment(body: string): Promise<boolean> {
    const anchor = this.draft();
    if (!anchor) {
      return Promise.resolve(false);
    }
    const input: NewReviewComment = { ...anchor, body };
    return this.post('new', (key) => this.api.create(key, input));
  }

  /** Replies to a thread (GitHub replies go to the thread's first comment). */
  reply(thread: PrReviewThread, body: string): Promise<boolean> {
    const root = thread.comments[0];
    if (!root) {
      return Promise.resolve(false);
    }
    return this.post(thread.id, (key) => this.api.reply(key, root.id, { body }));
  }

  /** Resolves (true) or reactivates (false) a thread. `posting` is `status:<threadId>` meanwhile. */
  setResolved(thread: PrReviewThread, resolved: boolean): Promise<boolean> {
    return this.post(statusKey(thread.id), (key) => this.api.setResolved(key, thread.id, { resolved }));
  }

  private async post(what: string, call: (key: NonNullable<ReturnType<PrDetailStore['key']>>) => Observable<PrReviewThread[]>): Promise<boolean> {
    const key = this.detail.key();
    if (!key || this.posting()) {
      return false;
    }
    this.posting.set(what);
    this.lastAction.set(what);
    this.postError.set(null);
    try {
      this.resource.set(await firstValueFrom(call(key)));
      this.draft.set(null);
      this.replyingTo.set(null);
      return true;
    } catch (err) {
      this.postError.set(toApiError(err));
      return false;
    } finally {
      this.posting.set(null);
    }
  }
}
