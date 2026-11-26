import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { PrFilter, Repo } from '@pr-manager/contracts';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { PullRequestApi } from '../data-access/pull-request.api';
import { RepoApi } from '../data-access/repo.api';
import { toApiError } from '../data-access/api-error';
import { UserPrefsService } from './user-prefs.service';

export const SEARCH_DEBOUNCE_MS = 300;

export function repoKey(repo: Repo): string {
  return `${repo.owner}/${repo.name}`;
}

/** All PR-list state and logic. UI reads signals and calls the set* methods. */
@Injectable({ providedIn: 'root' })
export class PrListStore {
  private readonly repoApi = inject(RepoApi);
  private readonly prApi = inject(PullRequestApi);
  private readonly prefs = inject(UserPrefsService);

  private readonly selectedKey = signal<string | null>(this.prefs.lastRepoKey);
  readonly filter = signal<PrFilter>(this.prefs.lastFilter);
  readonly searchInput = signal('');

  private readonly search = toSignal(
    toObservable(this.searchInput).pipe(
      map((s) => s.trim()),
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  private readonly reposResource = rxResource({ stream: () => this.repoApi.list() });

  readonly repos = computed(() => (this.reposResource.hasValue() ? this.reposResource.value() : []));

  /** The remembered repo, else the default: the first one in repos.config.json (Passport). */
  readonly selectedRepo = computed(() => {
    const repos = this.repos();
    return repos.find((r) => repoKey(r) === this.selectedKey()) ?? repos[0] ?? null;
  });
  readonly selectedRepoKey = computed(() => {
    const repo = this.selectedRepo();
    return repo ? repoKey(repo) : null;
  });

  private readonly prsResource = rxResource({
    params: () => {
      const repo = this.selectedRepo();
      return repo ? { repo, filter: this.filter(), search: this.search() } : undefined;
    },
    stream: ({ params }) => this.prApi.list(params.repo, params.filter, params.search),
  });

  readonly prs = computed(() => (this.prsResource.hasValue() ? this.prsResource.value() : []));
  readonly loading = computed(() => this.prsResource.isLoading() || this.reposResource.isLoading());
  readonly error = computed(() => {
    const err = this.prsResource.error() ?? this.reposResource.error();
    return err ? toApiError(err) : null;
  });

  constructor() {
    effect(() => {
      this.prefs.lastRepoKey = this.selectedKey();
      this.prefs.lastFilter = this.filter();
    });
  }

  selectRepo(key: string | null): void {
    this.selectedKey.set(key || null);
  }

  setFilter(filter: PrFilter): void {
    this.filter.set(filter);
  }

  setSearch(text: string): void {
    this.searchInput.set(text);
  }

  refresh(): void {
    this.prsResource.reload();
  }
}
