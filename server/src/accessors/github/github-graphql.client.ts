import { AppError } from '../../errors';
import { githubHeaders, readResetAt, requireToken, sendWithRetry, throwForHttpError } from './github-http';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

export interface GraphQLError {
  type?: string;
  message: string;
  path?: (string | number)[];
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: GraphQLError[];
}

/** Thin GitHub GraphQL transport: auth, HTTP errors, rate-limit detection. No business rules. */
export class GitHubGraphQLClient {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** Throws on any GraphQL error. */
  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const { data, errors } = await this.queryPartial<T>(query, variables);
    if (errors.length) {
      throw this.toAppError(errors);
    }
    return data;
  }

  /**
   * Returns partial data plus field-level errors (e.g. FORBIDDEN on nodes the token can't read).
   * Still throws for transport errors, rate limits, and when no data came back at all.
   */
  async queryPartial<T>(query: string, variables: Record<string, unknown> = {}): Promise<{ data: T; errors: GraphQLError[] }> {
    requireToken(this.token);

    const response = await sendWithRetry(() =>
      this.fetchFn(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: githubHeaders(this.token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ query, variables }),
      }),
    );
    throwForHttpError(response);

    const body = (await response.json()) as GraphQLResponse<T>;
    const errors = body.errors ?? [];
    if (errors.some((e) => e.type === 'RATE_LIMITED')) {
      throw new AppError(429, 'GitHub rate limit reached.', readResetAt(response));
    }
    if (!body.data) {
      throw errors.length ? this.toAppError(errors) : new AppError(502, 'GitHub returned an empty response.');
    }
    return { data: body.data, errors };
  }

  private toAppError(errors: GraphQLError[]): AppError {
    const first = errors[0];
    switch (first.type) {
      case 'NOT_FOUND':
        return new AppError(404, first.message);
      case 'FORBIDDEN':
        return new AppError(403, `GitHub denied the action: ${first.message}. Check the token has Pull requests: write.`);
      case 'UNPROCESSABLE':
        return new AppError(422, first.message);
      default:
        return new AppError(502, `GitHub error: ${errors.map((e) => e.message).join('; ')}`);
    }
  }
}
