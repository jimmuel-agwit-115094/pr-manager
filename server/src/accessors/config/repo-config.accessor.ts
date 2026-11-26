import { readFile } from 'node:fs/promises';
import type { Repo } from '@pr-manager/contracts';
import { AppError } from '../../errors';

/** Reads the repo list from repos.config.json. Re-read on each call so edits apply without restart. */
export class RepoConfigAccessor {
  constructor(private readonly path: string) {}

  async getAll(): Promise<Repo[]> {
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as Repo[];
    } catch (err) {
      throw new AppError(500, `Could not read repos.config.json: ${(err as Error).message}`);
    }
  }
}
