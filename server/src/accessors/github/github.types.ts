/** Raw GitHub GraphQL shapes. Only accessors and mappers should know about these. */

export type GitHubMergeable = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
export type GitHubRollupState = 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED';

export interface GitHubPullRequestNode {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  headRefName: string;
  baseRefName: string;
  mergeable: GitHubMergeable;
  author: { login: string; avatarUrl: string } | null;
  comments: { totalCount: number };
  reviewThreads: { totalCount: number };
  commits: {
    nodes: { commit: { statusCheckRollup: { state: GitHubRollupState } | null } }[];
  };
}

export interface GitHubViewer {
  login: string;
  avatarUrl: string;
}

export type GitHubPrState = 'OPEN' | 'CLOSED' | 'MERGED';
export type GitHubReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
export type GitHubReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED';

export interface GitHubPullRequestDetailNode extends GitHubPullRequestNode {
  id: string;
  state: GitHubPrState;
  body: string;
  reviewDecision: GitHubReviewDecision | null;
  viewerLatestReview: { state: GitHubReviewState } | null;
  latestOpinionatedReviews: { nodes: { state: GitHubReviewState }[] };
}

export type GitHubCheckStatus = 'REQUESTED' | 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'WAITING' | 'PENDING';
export type GitHubCheckConclusion =
  | 'ACTION_REQUIRED'
  | 'TIMED_OUT'
  | 'CANCELLED'
  | 'FAILURE'
  | 'SUCCESS'
  | 'NEUTRAL'
  | 'SKIPPED'
  | 'STARTUP_FAILURE'
  | 'STALE';
export type GitHubStatusState = 'EXPECTED' | 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS';

export interface GitHubCheckRunNode {
  __typename: 'CheckRun';
  name: string;
  status: GitHubCheckStatus;
  conclusion: GitHubCheckConclusion | null;
  detailsUrl: string | null;
  title: string | null;
  summary: string | null;
  checkSuite: { app: { slug: string; name: string } | null } | null;
  annotations: { nodes: { message: string; title: string | null; annotationLevel: 'FAILURE' | 'WARNING' | 'NOTICE' | null }[] } | null;
}

export interface GitHubStatusContextNode {
  __typename: 'StatusContext';
  context: string;
  state: GitHubStatusState;
  targetUrl: string | null;
  description: string | null;
}

/** Contexts the token can't read come back as null (with a FORBIDDEN error). */
export type GitHubCheckContext = GitHubCheckRunNode | GitHubStatusContextNode | null;

export interface GitHubPullRequestChecks {
  rollupState: GitHubRollupState | null;
  contexts: GitHubCheckContext[];
  /** True when some contexts were hidden by missing token permissions. */
  forbidden: boolean;
}

/** One entry from REST `GET /repos/{o}/{r}/pulls/{n}/files`. `patch` is absent for binary or very large files. */
export interface GitHubPullRequestFile {
  filename: string;
  previous_filename?: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  patch?: string;
}

/** Subset of REST `GET /repos/{o}/{r}/pulls/{n}`. `head.repo` is null when the fork was deleted. */
export interface GitHubPullRequestHead {
  head: { sha: string; repo: { full_name: string } | null };
}

export interface GitHubReviewCommentNode {
  databaseId: number;
  author: { login: string; avatarUrl: string } | null;
  bodyHTML: string;
  createdAt: string;
  url: string;
}

export interface GitHubReviewThreadNode {
  id: string;
  path: string;
  diffSide: 'LEFT' | 'RIGHT';
  line: number | null;
  originalLine: number | null;
  isResolved: boolean;
  isOutdated: boolean;
  viewerCanResolve: boolean;
  viewerCanUnresolve: boolean;
  comments: { nodes: GitHubReviewCommentNode[] };
  /** The thread's first comment only, for the diff hunk it was written on. */
  firstComment: { nodes: { diffHunk: string }[] };
}
