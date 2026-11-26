import { AppError } from '../../errors';

/** Transport helpers shared by the GraphQL and REST clients. */

export function requireToken(token: string): void {
  if (!token) {
    throw new AppError(401, 'GITHUB_TOKEN is missing. Add it to server/.env.');
  }
}

export function githubHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'User-Agent': 'pr-manager', ...extra };
}

/** GitHub occasionally returns a transient 502/503/504 on heavier requests; retry once. */
export async function sendWithRetry(send: () => Promise<Response>): Promise<Response> {
  const response = await send();
  return response.status >= 502 && response.status <= 504 ? send() : response;
}

export function readResetAt(response: Response): string | undefined {
  const reset = response.headers.get('x-ratelimit-reset');
  return reset ? new Date(Number(reset) * 1000).toISOString() : undefined;
}

/** Maps auth, rate-limit and other non-2xx responses to AppError. `notFound` lets REST callers keep a 404. */
export function throwForHttpError(response: Response, notFound?: string): void {
  if (response.status === 401) {
    throw new AppError(401, 'GitHub token is invalid or expired.');
  }
  if (response.status === 403 || response.status === 429) {
    if (response.headers.get('x-ratelimit-remaining') === '0' || response.status === 429) {
      throw new AppError(429, 'GitHub rate limit reached.', readResetAt(response));
    }
    throw new AppError(403, 'GitHub denied access. Check the token permissions.');
  }
  if (response.status === 404 && notFound) {
    throw new AppError(404, notFound);
  }
  if (!response.ok) {
    throw new AppError(502, `GitHub returned HTTP ${response.status}.`);
  }
}
