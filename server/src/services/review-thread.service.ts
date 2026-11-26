import { MAX_COMMENT_LENGTH, type NewReviewComment, type PrReviewThread } from '@pr-manager/contracts';
import type { PullRequestFilesAccessor } from '../accessors/github/pull-request-files.accessor';
import type { ReviewThreadAccessor } from '../accessors/github/review-thread.accessor';
import { AppError } from '../errors';
import { toPrReviewThread } from './mappers/review-thread.mapper';
import type { RepoService } from './repo.service';

/** Inline review comments (Files Changed and Overview tabs). Writes return the refreshed thread list. */
export class ReviewThreadService {
  constructor(
    private readonly threads: ReviewThreadAccessor,
    private readonly files: PullRequestFilesAccessor,
    private readonly repos: RepoService,
  ) {}

  async list(owner: string, name: string, number: number): Promise<PrReviewThread[]> {
    const repo = await this.repos.getConfigured(owner, name);
    const nodes = await this.threads.list(repo.owner, repo.name, number);
    if (!nodes) {
      throw new AppError(404, `Pull request #${number} was not found in ${repo.owner}/${repo.name}.`);
    }
    return nodes.filter((n) => n.comments.nodes.length > 0).map(toPrReviewThread);
  }

  /** Posts a comment on the PR's current head commit. */
  async create(owner: string, name: string, number: number, input: NewReviewComment): Promise<PrReviewThread[]> {
    const repo = await this.repos.getConfigured(owner, name);
    const body = checkBody(input.body);
    const { head } = await this.files.getHead(repo.owner, repo.name, number);
    await this.threads.create(repo.owner, repo.name, number, {
      commitId: head.sha,
      path: input.path,
      line: input.line,
      side: input.side,
      body,
    });
    return this.list(repo.owner, repo.name, number);
  }

  /** Resolves or reactivates a thread. Only threads on this PR are accepted. */
  async setResolved(owner: string, name: string, number: number, threadId: string, resolved: boolean): Promise<PrReviewThread[]> {
    const repo = await this.repos.getConfigured(owner, name);
    const thread = (await this.list(repo.owner, repo.name, number)).find((t) => t.id === threadId);
    if (!thread) {
      throw new AppError(404, `Thread ${threadId} was not found on pull request #${number}.`);
    }
    if (thread.isResolved !== resolved) {
      if (resolved ? !thread.canResolve : !thread.canUnresolve) {
        throw new AppError(403, `You can't ${resolved ? 'resolve' : 'reactivate'} this thread.`);
      }
      await this.threads.setResolved(threadId, resolved);
    }
    return this.list(repo.owner, repo.name, number);
  }

  async reply(owner: string, name: string, number: number, commentId: number, body: string): Promise<PrReviewThread[]> {
    const repo = await this.repos.getConfigured(owner, name);
    await this.threads.reply(repo.owner, repo.name, number, commentId, checkBody(body));
    return this.list(repo.owner, repo.name, number);
  }
}

function checkBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new AppError(400, 'Comment is empty.');
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new AppError(400, `Comment is longer than ${MAX_COMMENT_LENGTH} characters.`);
  }
  return trimmed;
}
