import { AppError } from '../../errors';
import { githubHeaders, requireToken, sendWithRetry, throwForHttpError } from './github-http';

const GITHUB_API_URL = 'https://api.github.com';
const JSON_ACCEPT = 'application/vnd.github+json';

/**
 * Thin GitHub REST transport, for what GraphQL doesn't do well: PR file patches, raw file content,
 * and single (non-pending) review comments. Same auth, retry and error mapping as the GraphQL client.
 */
export class GitHubRestClient {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** GET a JSON resource. `path` starts with `/`, e.g. `/repos/o/r/pulls/1/files?page=1`. A 404 throws with `notFound`. */
  async get<T>(path: string, notFound = 'Not found on GitHub.'): Promise<T> {
    const response = await this.send(path, JSON_ACCEPT, notFound);
    return (await response.json()) as T;
  }

  /** GET a resource as raw text, e.g. file contents. */
  async getText(path: string, notFound = 'Not found on GitHub.'): Promise<string> {
    const response = await this.send(path, 'application/vnd.github.raw+json', notFound);
    return response.text();
  }

  /** POST JSON. Not retried: it's a write. A 422 throws with GitHub's validation message. */
  async post<T>(path: string, body: unknown, notFound = 'Not found on GitHub.'): Promise<T> {
    requireToken(this.token);
    const response = await this.fetchFn(`${GITHUB_API_URL}${path}`, {
      method: 'POST',
      headers: this.headers(JSON_ACCEPT, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (response.status === 422) {
      throw new AppError(422, await validationMessage(response));
    }
    throwForHttpError(response, notFound);
    return (await response.json()) as T;
  }

  private async send(path: string, accept: string, notFound: string): Promise<Response> {
    requireToken(this.token);
    const response = await sendWithRetry(() => this.fetchFn(`${GITHUB_API_URL}${path}`, { headers: this.headers(accept) }));
    throwForHttpError(response, notFound);
    return response;
  }

  private headers(accept: string, extra: Record<string, string> = {}): Record<string, string> {
    return githubHeaders(this.token, { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...extra });
  }
}

type ValidationBody = { message?: string; errors?: (string | { message?: string; field?: string; code?: string })[] };

/** GitHub 422 bodies: `{ message, errors: [string | { message?, field?, code? }] }`. */
async function validationMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ValidationBody;
    const details = (body.errors ?? [])
      .map((e) => (typeof e === 'string' ? e : (e.message ?? [e.field, e.code].filter(Boolean).join(' '))))
      .filter(Boolean);
    return [body.message ?? 'GitHub rejected the request.', ...details].join(': ');
  } catch {
    return 'GitHub rejected the request.';
  }
}
