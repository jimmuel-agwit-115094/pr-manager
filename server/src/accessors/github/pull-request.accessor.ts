import type { GitHubGraphQLClient } from './github-graphql.client';
import type {
  GitHubCheckContext,
  GitHubPullRequestChecks,
  GitHubPullRequestDetailNode,
  GitHubPullRequestNode,
  GitHubRollupState,
} from './github.types';
import { ADD_COMMENT, GET_PULL_REQUEST_CHECKS } from './pull-request-checks.query';

const PR_SUMMARY_FIELDS = /* GraphQL */ `
  number
  title
  url
  isDraft
  createdAt
  updatedAt
  headRefName
  baseRefName
  mergeable
  author { login avatarUrl }
  comments { totalCount }
  reviewThreads { totalCount }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
`;

const SEARCH_PULL_REQUESTS = /* GraphQL */ `
  query SearchPullRequests($q: String!, $first: Int!) {
    search(query: $q, type: ISSUE, first: $first) {
      nodes {
        ... on PullRequest { ${PR_SUMMARY_FIELDS} }
      }
    }
  }
`;

const GET_PULL_REQUEST = /* GraphQL */ `
  query GetPullRequest($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        ${PR_SUMMARY_FIELDS}
        id
        state
        body
        reviewDecision
        viewerLatestReview { state }
        latestOpinionatedReviews(first: 50) { nodes { state } }
      }
    }
  }
`;

const APPROVE_PULL_REQUEST = /* GraphQL */ `
  mutation ApprovePullRequest($id: ID!) {
    addPullRequestReview(input: { pullRequestId: $id, event: APPROVE }) {
      pullRequestReview { state }
    }
  }
`;

/** Data access for GitHub pull requests. No filter or permission logic here. */
export class PullRequestAccessor {
  constructor(private readonly client: GitHubGraphQLClient) {}

  async search(searchQuery: string, first = 50): Promise<GitHubPullRequestNode[]> {
    const data = await this.client.query<{ search: { nodes: (GitHubPullRequestNode | Record<string, never>)[] } }>(
      SEARCH_PULL_REQUESTS,
      { q: searchQuery, first },
    );
    // Non-PR results come back as empty objects from the inline fragment.
    return data.search.nodes.filter((n): n is GitHubPullRequestNode => 'number' in n);
  }

  async get(owner: string, name: string, number: number): Promise<GitHubPullRequestDetailNode | null> {
    const data = await this.client.query<{ repository: { pullRequest: GitHubPullRequestDetailNode | null } | null }>(
      GET_PULL_REQUEST,
      { owner, name, number },
    );
    return data.repository?.pullRequest ?? null;
  }

  /** Submit an APPROVE review. `nodeId` is the PR's GraphQL node id. */
  async approve(nodeId: string): Promise<void> {
    await this.client.query(APPROVE_PULL_REQUEST, { id: nodeId });
  }

  /** Post a PR conversation comment. */
  async comment(nodeId: string, body: string): Promise<void> {
    await this.client.query(ADD_COMMENT, { id: nodeId, body });
  }

  /** Checks on the PR head commit. Unreadable check runs come back as null with `forbidden: true`. */
  async getChecks(owner: string, name: string, number: number): Promise<GitHubPullRequestChecks | null> {
    type Shape = {
      repository: {
        pullRequest: {
          commits: {
            nodes: { commit: { statusCheckRollup: { state: GitHubRollupState; contexts: { nodes: GitHubCheckContext[] } } | null } }[];
          };
        } | null;
      } | null;
    };
    const { data, errors } = await this.client.queryPartial<Shape>(GET_PULL_REQUEST_CHECKS, { owner, name, number });
    const pr = data.repository?.pullRequest;
    if (!pr) {
      return null;
    }
    const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup ?? null;
    return {
      rollupState: rollup?.state ?? null,
      contexts: rollup?.contexts.nodes ?? [],
      forbidden: errors.some((e) => e.type === 'FORBIDDEN'),
    };
  }
}
