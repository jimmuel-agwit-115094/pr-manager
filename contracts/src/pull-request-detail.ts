import type { PullRequestSummary } from './pull-request';

export type PrState = 'OPEN' | 'CLOSED' | 'MERGED';
export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | 'NONE';
export type MergeableState = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';

export interface PullRequestDetail extends PullRequestSummary {
  state: PrState;
  body: string;
  reviewDecision: ReviewDecision;
  approvalCount: number;
  mergeable: MergeableState;
  /** True when the signed-in user's latest review is an approval. */
  approvedByMe: boolean;
}
