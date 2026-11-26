import { Injectable } from '@angular/core';
import { isPrFilter, type PrFilter } from '@pr-manager/contracts';

const REPO_KEY = 'prm.selectedRepo';
const FILTER_KEY = 'prm.filter';

/** Per-browser conveniences. Storage can be unavailable, so every access is guarded. */
@Injectable({ providedIn: 'root' })
export class UserPrefsService {
  get lastRepoKey(): string | null {
    return this.read(REPO_KEY);
  }

  set lastRepoKey(value: string | null) {
    this.write(REPO_KEY, value);
  }

  get lastFilter(): PrFilter {
    const value = this.read(FILTER_KEY);
    return isPrFilter(value) ? value : 'all';
  }

  set lastFilter(value: PrFilter) {
    this.write(FILTER_KEY, value);
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {
      // Storage blocked: preference just won't persist.
    }
  }
}
