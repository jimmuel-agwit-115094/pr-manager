import { AppError } from '../../errors';

/** Thin Azure DevOps REST transport: base URL, PAT auth, HTTP error mapping. No business rules. */
export class AdoRestClient {
  constructor(
    private readonly org: string,
    private readonly pat: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get<T>(project: string, path: string, query: Record<string, string | number> = {}): Promise<T> {
    return this.send<T>('GET', project, path, query);
  }

  post<T>(project: string, path: string, body: unknown, query: Record<string, string | number> = {}): Promise<T> {
    return this.send<T>('POST', project, path, query, body);
  }

  patch<T>(project: string, path: string, body: unknown, query: Record<string, string | number> = {}): Promise<T> {
    return this.send<T>('PATCH', project, path, query, body);
  }

  /** Organization-level POST (no project segment), with an explicit api-version for preview APIs. */
  orgPost<T>(path: string, body: unknown, apiVersion: string): Promise<T> {
    return this.send<T>('POST', null, path, { 'api-version': apiVersion }, body);
  }

  private async send<T>(
    method: string,
    project: string | null,
    path: string,
    query: Record<string, string | number>,
    body?: unknown,
  ): Promise<T> {
    if (!this.pat) {
      throw new AppError(401, 'ADO PAT is missing. Set ADO_PAT in server/.env (Build: Read & execute).');
    }

    const scope = project === null ? '' : `/${encodeURIComponent(project)}`;
    const url = new URL(`https://dev.azure.com/${encodeURIComponent(this.org)}${scope}/_apis/${path}`);
    for (const [key, value] of Object.entries({ 'api-version': '7.1', ...query })) {
      url.searchParams.set(key, String(value));
    }

    const response = await this.fetchFn(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`:${this.pat}`).toString('base64')}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });

    // ADO answers a bad PAT with 203 + HTML sign-in page or a 302 redirect, not always 401.
    if (response.status === 401 || response.status === 203 || (response.status >= 300 && response.status < 400)) {
      throw new AppError(401, 'ADO PAT is invalid or expired.');
    }
    if (response.status === 403) {
      throw new AppError(403, 'ADO denied access. The PAT needs Build: Read & execute.');
    }
    if (response.status === 404) {
      throw new AppError(404, 'ADO resource not found. Check ADO_ORG / ADO_PROJECT.');
    }
    if (!response.ok) {
      const detail = await this.readMessage(response);
      throw new AppError(response.status === 400 ? 400 : 502, `ADO returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`);
    }
    // Some writes (e.g. stage retry) answer 204 or an empty body; there's nothing to parse.
    const text = response.status === 204 ? '' : await response.text();
    if (!text) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AppError(502, 'ADO returned a response that is not JSON.');
    }
  }

  private async readMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string };
      return body.message ?? '';
    } catch {
      return '';
    }
  }
}
