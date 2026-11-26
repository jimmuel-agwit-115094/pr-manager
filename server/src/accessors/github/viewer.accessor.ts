import type { GitHubGraphQLClient } from './github-graphql.client';
import type { GitHubViewer } from './github.types';

export class ViewerAccessor {
  constructor(private readonly client: GitHubGraphQLClient) {}

  async get(): Promise<GitHubViewer> {
    const data = await this.client.query<{ viewer: GitHubViewer }>('query { viewer { login avatarUrl } }');
    return data.viewer;
  }
}
