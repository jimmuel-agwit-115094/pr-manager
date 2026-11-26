import type { CurrentUser } from '@pr-manager/contracts';
import type { ViewerAccessor } from '../accessors/github/viewer.accessor';
import { TtlCache } from './ttl-cache';

export class UserService {
  private readonly cache = new TtlCache<CurrentUser>(10 * 60_000);

  constructor(private readonly viewer: ViewerAccessor) {}

  getCurrentUser(): Promise<CurrentUser> {
    return this.cache.getOrAdd('viewer', async () => {
      const { login, avatarUrl } = await this.viewer.get();
      return { login, avatarUrl };
    });
  }
}
