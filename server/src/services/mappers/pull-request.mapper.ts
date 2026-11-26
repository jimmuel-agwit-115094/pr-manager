import type { CiState, PullRequestSummary } from '@pr-manager/contracts';
import type { GitHubPullRequestNode, GitHubRollupState } from '../../accessors/github/github.types';

const CI_STATE: Record<GitHubRollupState, CiState> = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  ERROR: 'FAILURE',
  PENDING: 'PENDING',
  EXPECTED: 'PENDING',
};

export function toPullRequestSummary(node: GitHubPullRequestNode, viewerLogin: string): PullRequestSummary {
  const rollup = node.commits.nodes[0]?.commit.statusCheckRollup;
  const author = node.author?.login ?? 'ghost';

  return {
    number: node.number,
    title: node.title,
    url: node.url,
    branch: node.headRefName,
    target: node.baseRefName,
    author,
    authorAvatar: node.author?.avatarUrl ?? '',
    isMine: author.toLowerCase() === viewerLogin.toLowerCase(),
    isDraft: node.isDraft,
    hasConflicts: node.mergeable === 'CONFLICTING',
    ciState: rollup ? CI_STATE[rollup.state] : 'NONE',
    commentCount: node.comments.totalCount + node.reviewThreads.totalCount,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}
