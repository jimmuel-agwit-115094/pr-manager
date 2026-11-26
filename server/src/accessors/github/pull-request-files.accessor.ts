import type { GitHubRestClient } from './github-rest.client';
import type { GitHubPullRequestFile, GitHubPullRequestHead } from './github.types';

const PER_PAGE = 100;
/** GitHub returns at most 3000 files for a PR (30 pages of 100). */
export const MAX_FILE_PAGES = 30;

/** Changed files of a PR, with patches, and file contents. REST only: GraphQL doesn't expose patches. */
export class PullRequestFilesAccessor {
  constructor(private readonly client: GitHubRestClient) {}

  /** All pages, in GitHub's order. A missing PR throws 404. */
  async list(owner: string, name: string, number: number): Promise<GitHubPullRequestFile[]> {
    const base = `${repoPath(owner, name)}/pulls/${number}/files`;
    const notFound = `Pull request #${number} was not found in ${owner}/${name}.`;
    const files: GitHubPullRequestFile[] = [];
    for (let page = 1; page <= MAX_FILE_PAGES; page++) {
      const batch = await this.client.get<GitHubPullRequestFile[]>(`${base}?per_page=${PER_PAGE}&page=${page}`, notFound);
      files.push(...batch);
      if (batch.length < PER_PAGE) {
        break;
      }
    }
    return files;
  }

  /** Head commit and head repo (may be a fork) of a PR. */
  getHead(owner: string, name: string, number: number): Promise<GitHubPullRequestHead> {
    return this.client.get<GitHubPullRequestHead>(
      `${repoPath(owner, name)}/pulls/${number}`,
      `Pull request #${number} was not found in ${owner}/${name}.`,
    );
  }

  /** Raw file text at a commit. `fullName` is `owner/repo`. */
  getRawContent(fullName: string, path: string, ref: string): Promise<string> {
    const [owner, name] = fullName.split('/');
    const filePath = path.split('/').map(encodeURIComponent).join('/');
    return this.client.getText(
      `${repoPath(owner, name)}/contents/${filePath}?ref=${encodeURIComponent(ref)}`,
      `${path} was not found at ${ref.slice(0, 7)}.`,
    );
  }
}

function repoPath(owner: string, name: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}
