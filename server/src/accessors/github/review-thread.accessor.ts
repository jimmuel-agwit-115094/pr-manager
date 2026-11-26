import type { GitHubGraphQLClient } from './github-graphql.client';
import type { GitHubRestClient } from './github-rest.client';
import type { GitHubReviewThreadNode } from './github.types';

const GET_REVIEW_THREADS = /* GraphQL */ `
  query GetReviewThreads($owner: String!, $name: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            path
            diffSide
            line
            originalLine
            isResolved
            isOutdated
            viewerCanResolve
            viewerCanUnresolve
            comments(first: 100) {
              nodes { databaseId author { login avatarUrl } bodyHTML createdAt url }
            }
            firstComment: comments(first: 1) {
              nodes { diffHunk }
            }
          }
        }
      }
    }
  }
`;

const RESOLVE_THREAD = /* GraphQL */ `
  mutation ResolveReviewThread($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) { thread { id } }
  }
`;

const UNRESOLVE_THREAD = /* GraphQL */ `
  mutation UnresolveReviewThread($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) { thread { id } }
  }
`;

/** Max thread pages read for one PR (100 threads each). */
const MAX_THREAD_PAGES = 10;

type ThreadsPage = {
  repository: {
    pullRequest: {
      reviewThreads: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GitHubReviewThreadNode[] };
    } | null;
  } | null;
};

/**
 * Inline review threads. Reads and resolve / reactivate go through GraphQL (threads carry resolved / outdated state);
 * comments and replies go through REST, which posts a single comment right away instead of adding it to a pending review.
 */
export class ReviewThreadAccessor {
  constructor(
    private readonly graphql: GitHubGraphQLClient,
    private readonly rest: GitHubRestClient,
  ) {}

  /** null when the PR doesn't exist. */
  async list(owner: string, name: string, number: number): Promise<GitHubReviewThreadNode[] | null> {
    const threads: GitHubReviewThreadNode[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_THREAD_PAGES; page++) {
      const data: ThreadsPage = await this.graphql.query<ThreadsPage>(GET_REVIEW_THREADS, { owner, name, number, after });
      const pr = data.repository?.pullRequest;
      if (!pr) {
        return null;
      }
      threads.push(...pr.reviewThreads.nodes);
      if (!pr.reviewThreads.pageInfo.hasNextPage) {
        break;
      }
      after = pr.reviewThreads.pageInfo.endCursor;
    }
    return threads;
  }

  /** Starts a new thread with one comment on `line` of `path` at `commitId`. */
  async create(
    owner: string,
    name: string,
    number: number,
    input: { commitId: string; path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void> {
    await this.rest.post(`${repoPath(owner, name)}/pulls/${number}/comments`, {
      body: input.body,
      commit_id: input.commitId,
      path: input.path,
      line: input.line,
      side: input.side,
    });
  }

  /** Resolves (`true`) or reactivates (`false`) a thread by its GraphQL node id. */
  async setResolved(threadId: string, resolved: boolean): Promise<void> {
    await this.graphql.query(resolved ? RESOLVE_THREAD : UNRESOLVE_THREAD, { threadId });
  }

  /** Replies to the thread whose first comment has database id `commentId`. */
  async reply(owner: string, name: string, number: number, commentId: number, body: string): Promise<void> {
    await this.rest.post(
      `${repoPath(owner, name)}/pulls/${number}/comments/${commentId}/replies`,
      { body },
      `Comment ${commentId} was not found on pull request #${number}.`,
    );
  }
}

function repoPath(owner: string, name: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}
