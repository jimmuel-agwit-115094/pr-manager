import type { PullRequestDetail, ReviewDecision } from '@pr-manager/contracts';
import type { GitHubPullRequestDetailNode } from '../../accessors/github/github.types';
import { toPullRequestSummary } from './pull-request.mapper';

export function toPullRequestDetail(node: GitHubPullRequestDetailNode, viewerLogin: string): PullRequestDetail {
  return {
    ...toPullRequestSummary(node, viewerLogin),
    state: node.state,
    body: node.body,
    reviewDecision: (node.reviewDecision ?? 'NONE') satisfies ReviewDecision,
    approvalCount: node.latestOpinionatedReviews.nodes.filter((r) => r.state === 'APPROVED').length,
    mergeable: node.mergeable,
    approvedByMe: node.viewerLatestReview?.state === 'APPROVED',
  };
}
