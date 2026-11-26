import type { DiffLine, PrReviewThread } from '@pr-manager/contracts';
import type { GitHubReviewThreadNode } from '../../accessors/github/github.types';
import { parsePatch } from './pr-files.mapper';

/** Lines of code shown above a thread on the Overview tab. */
export const SNIPPET_LINES = 8;

/** The code a thread was written on: the end of its diff hunk, where GitHub puts the commented line. */
export function toSnippet(diffHunk: string | undefined, maxLines = SNIPPET_LINES): DiffLine[] {
  if (!diffHunk) {
    return [];
  }
  return parsePatch(diffHunk)
    .filter((l) => l.type !== 'hunk')
    .slice(-maxLines)
    .map((l) => ({ ...l, commentable: false }));
}

export function toPrReviewThread(node: GitHubReviewThreadNode): PrReviewThread {
  return {
    id: node.id,
    path: node.path,
    side: node.diffSide,
    // Outdated threads lose `line`; their original line still says roughly where in the file they belong.
    line: node.line ?? node.originalLine,
    isResolved: node.isResolved,
    isOutdated: node.isOutdated || node.line === null,
    canResolve: node.viewerCanResolve,
    canUnresolve: node.viewerCanUnresolve,
    snippet: toSnippet(node.firstComment?.nodes[0]?.diffHunk),
    comments: node.comments.nodes.map((c) => ({
      id: c.databaseId,
      author: c.author?.login ?? 'ghost',
      authorAvatar: c.author?.avatarUrl ?? '',
      bodyHtml: c.bodyHTML,
      createdAt: c.createdAt,
      url: c.url,
    })),
  };
}
