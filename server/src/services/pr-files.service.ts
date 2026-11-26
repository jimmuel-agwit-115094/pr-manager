import type { PrFileView, PrFiles } from '@pr-manager/contracts';
import type { PullRequestFilesAccessor } from '../accessors/github/pull-request-files.accessor';
import { AppError } from '../errors';
import { expandToFullFile, toPrFiles } from './mappers/pr-files.mapper';
import type { RepoService } from './repo.service';
import { TtlCache } from './ttl-cache';

/** The PR's file list plus where its head is, fetched together and reused by every file view. */
interface FilesSnapshot {
  files: PrFiles;
  /** null when the head couldn't be read; file views then show hunks only. */
  head: { sha: string; repoFullName: string } | null;
}

/** Full views at a given head sha never change, so they're kept longer. */
const VIEW_TTL_MS = 10 * 60_000;
const MAX_CACHED_VIEWS = 40;

/** Files Changed tab: the PR's changed files with parsed diffs, and one file's full view. */
export class PrFilesService {
  private readonly snapshots: TtlCache<FilesSnapshot>;
  private readonly views = new TtlCache<PrFileView>(VIEW_TTL_MS, Date.now, MAX_CACHED_VIEWS);

  constructor(
    private readonly files: PullRequestFilesAccessor,
    private readonly repos: RepoService,
    cacheTtlMs = 30_000,
  ) {
    this.snapshots = new TtlCache(cacheTtlMs, Date.now, 20);
  }

  async get(owner: string, name: string, number: number): Promise<PrFiles> {
    return (await this.snapshot(owner, name, number)).files;
  }

  /**
   * The whole head file with the PR's changes marked. Falls back to the diff hunks when the
   * file was deleted, has no patch, or its content can't be fetched.
   */
  async getView(owner: string, name: string, number: number, path: string): Promise<PrFileView> {
    const { files, head } = await this.snapshot(owner, name, number);
    const file = files.files.find((f) => f.path === path);
    if (!file) {
      throw new AppError(404, `${path} is not changed in pull request #${number}.`);
    }
    const hunksOnly: PrFileView = { path, lines: file.lines, isFullFile: false };
    if (!head || !file.hasPatch || file.status === 'removed') {
      return hunksOnly;
    }

    try {
      return await this.views.getOrAdd(`${head.repoFullName}@${head.sha}:${path}`, async () => {
        const text = await this.files.getRawContent(head.repoFullName, path, head.sha);
        return { path, lines: expandToFullFile(file.lines, text), isFullFile: true };
      });
    } catch (err) {
      rethrowIfFatal(err);
      return hunksOnly;
    }
  }

  private async snapshot(owner: string, name: string, number: number): Promise<FilesSnapshot> {
    const repo = await this.repos.getConfigured(owner, name);
    return this.snapshots.getOrAdd(`${repo.owner}/${repo.name}#${number}`, async () => {
      // Head is needed by every file view; fetch it alongside the list instead of per file.
      const [list, head] = await Promise.all([
        this.files.list(repo.owner, repo.name, number),
        this.files.getHead(repo.owner, repo.name, number).catch((err: unknown) => {
          rethrowIfFatal(err);
          return null;
        }),
      ]);
      return {
        files: toPrFiles(list),
        head: head ? { sha: head.head.sha, repoFullName: head.head.repo?.full_name ?? `${repo.owner}/${repo.name}` } : null,
      };
    });
  }
}

/** Auth and rate-limit problems must surface; anything else (too large, fork gone) degrades to hunks. */
function rethrowIfFatal(err: unknown): void {
  if (err instanceof AppError && (err.status === 401 || err.status === 429)) {
    throw err;
  }
}
