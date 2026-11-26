import type { DiffLine } from './pr-files';

/** Which version of the file a review comment is on: LEFT = base (deleted lines), RIGHT = head. */
export type CommentSide = 'LEFT' | 'RIGHT';

export interface PrReviewComment {
  /** GitHub database id; replies are posted against the thread's first comment id. */
  id: number;
  author: string;
  authorAvatar: string;
  /** GitHub-rendered, sanitized HTML of the markdown body. */
  bodyHtml: string;
  createdAt: string;
  url: string;
}

/** A GitHub review thread: inline comments anchored to one line of one file. */
export interface PrReviewThread {
  id: string;
  path: string;
  side: CommentSide;
  /**
   * Line on `side`. For outdated threads (their line changed since) this is the line at the commit
   * they were written on, so it is only approximate. null when GitHub knows neither.
   */
  line: number | null;
  isResolved: boolean;
  isOutdated: boolean;
  /** Whether the signed-in user may resolve / reactivate the thread. */
  canResolve: boolean;
  canUnresolve: boolean;
  /** The last few lines of the diff the thread was written on (its line last). Empty when GitHub sends none. */
  snippet: DiffLine[];
  comments: PrReviewComment[];
}

export interface ThreadStatusChange {
  resolved: boolean;
}

export interface NewReviewComment {
  path: string;
  line: number;
  side: CommentSide;
  body: string;
}

export interface ReviewReply {
  body: string;
}

/** GitHub's limit for a comment body. */
export const MAX_COMMENT_LENGTH = 65_536;
