import type { PrFilter, PullRequestDetail, PullRequestSummary, Repo } from '@pr-manager/contracts';
import type { PullRequestAccessor } from '../accessors/github/pull-request.accessor';
import { AppError } from '../errors';
import { toPullRequestDetail } from './mappers/pull-request-detail.mapper';
import { toPullRequestSummary } from './mappers/pull-request.mapper';
import type { RepoService } from './repo.service';
import { TtlCache } from './ttl-cache';
import type { UserService } from './user.service';

const FILTER_QUALIFIER: Record<PrFilter, string> = {
  all: '',
  mine: 'author:@me',
  review: 'review-requested:@me',
};

/** Free text only: drop qualifier syntax so the search can't be widened beyond the repo. */
export function sanitizeSearchText(text: string): string {
  return text
    .replace(/["':]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

export function buildSearchQuery(repo: Repo, filter: PrFilter, text = ''): string {
  return [`repo:${repo.owner}/${repo.name}`, 'is:pr', 'is:open', FILTER_QUALIFIER[filter], sanitizeSearchText(text), 'sort:updated-desc']
    .filter(Boolean)
    .join(' ');
}

export class PullRequestService {
  private readonly cache: TtlCache<PullRequestSummary[]>;

  constructor(
    private readonly pullRequests: PullRequestAccessor,
    private readonly repos: RepoService,
    private readonly users: UserService,
    cacheTtlMs = 30_000,
  ) {
    this.cache = new TtlCache(cacheTtlMs);
  }

  async list(owner: string, name: string, filter: PrFilter, text = ''): Promise<PullRequestSummary[]> {
    const repo = await this.repos.getConfigured(owner, name);
    const query = buildSearchQuery(repo, filter, text);

    return this.cache.getOrAdd(query, async () => {
      const [viewer, nodes] = await Promise.all([this.users.getCurrentUser(), this.pullRequests.search(query)]);
      return nodes.map((n) => toPullRequestSummary(n, viewer.login));
    });
  }

  /** Not cached: the detail page must show live review and merge state. */
  async get(owner: string, name: string, number: number): Promise<PullRequestDetail> {
    const repo = await this.repos.getConfigured(owner, name);
    const [viewer, node] = await Promise.all([
      this.users.getCurrentUser(),
      this.pullRequests.get(repo.owner, repo.name, number),
    ]);
    if (!node) {
      throw new AppError(404, `Pull request #${number} was not found in ${repo.owner}/${repo.name}.`);
    }
    return toPullRequestDetail(node, viewer.login);
  }

  async approve(owner: string, name: string, number: number): Promise<PullRequestDetail> {
    const repo = await this.repos.getConfigured(owner, name);
    const [viewer, node] = await Promise.all([
      this.users.getCurrentUser(),
      this.pullRequests.get(repo.owner, repo.name, number),
    ]);
    if (!node) {
      throw new AppError(404, `Pull request #${number} was not found in ${repo.owner}/${repo.name}.`);
    }

    const current = toPullRequestDetail(node, viewer.login);
    if (current.state !== 'OPEN') {
      throw new AppError(409, 'Only open pull requests can be approved.');
    }
    if (current.isMine) {
      throw new AppError(409, 'GitHub does not allow approving your own pull request.');
    }
    if (current.approvedByMe) {
      return current;
    }

    await this.pullRequests.approve(node.id);
    this.cache.clear();
    return this.get(owner, name, number);
  }
}
