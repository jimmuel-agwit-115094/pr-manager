import type { Repo } from '@pr-manager/contracts';
import type { RepoConfigAccessor } from '../accessors/config/repo-config.accessor';
import { AppError } from '../errors';

export class RepoService {
  constructor(private readonly config: RepoConfigAccessor) {}

  list(): Promise<Repo[]> {
    return this.config.getAll();
  }

  /** Only repos in the config may be queried. */
  async getConfigured(owner: string, name: string): Promise<Repo> {
    const repo = (await this.config.getAll()).find(
      (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === name.toLowerCase(),
    );
    if (!repo) {
      throw new AppError(404, `Repo ${owner}/${name} is not in repos.config.json.`);
    }
    return repo;
  }
}
