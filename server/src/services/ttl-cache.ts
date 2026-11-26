/** Minimal in-memory TTL cache. With `maxEntries`, the oldest entry is dropped when full. */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = Infinity,
  ) {}

  clear(): void {
    this.entries.clear();
  }

  async getOrAdd(key: string, factory: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) {
      return hit.value;
    }
    const value = await factory();
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      // Map keeps insertion order, so the first key is the oldest.
      this.entries.delete(this.entries.keys().next().value as string);
    }
    return value;
  }
}
