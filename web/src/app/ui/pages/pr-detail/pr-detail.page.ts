import { ChangeDetectionStrategy, Component, computed, effect, inject, input, numberAttribute } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { CurrentUserStore } from '../../../services/current-user.store';
import { PrDetailStore } from '../../../services/pr-detail.store';

const TABS = [
  { path: 'overview', label: 'Overview' },
  { path: 'files', label: 'Files Changed' },
  { path: 'story', label: 'Story' },
  { path: 'commits', label: 'Commits' },
  { path: 'pipeline', label: 'Pipeline' },
];

const isWideTab = (url: string): boolean => /\/pipeline(?:[?#]|$)/.test(url);

@Component({
  selector: 'app-pr-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  providers: [PrDetailStore],
  templateUrl: './pr-detail.page.html',
  styleUrl: './pr-detail.page.scss',
})
export class PrDetailPage {
  protected readonly store = inject(PrDetailStore);
  protected readonly currentUser = inject(CurrentUserStore);
  protected readonly tabs = TABS;

  /** Tab content is ADO width (~1200px), except the Pipeline tab, whose stage graph uses the full window. */
  private readonly router = inject(Router);
  protected readonly wideTab = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => isWideTab(this.router.url)),
    ),
    { initialValue: isWideTab(this.router.url) },
  );

  // Bound from route params via withComponentInputBinding.
  readonly owner = input.required<string>();
  readonly repo = input.required<string>();
  readonly number = input.required({ transform: numberAttribute });

  /** ADO vocabulary for PR state. */
  protected readonly stateBadge = computed(() => {
    const d = this.store.detail();
    if (!d) {
      return null;
    }
    if (d.state === 'MERGED') {
      return { label: 'Completed', css: 'badge--completed' };
    }
    if (d.state === 'CLOSED') {
      return { label: 'Abandoned', css: 'badge--abandoned' };
    }
    return d.isDraft ? { label: 'Draft', css: 'badge--draft' } : { label: 'Active', css: 'badge--active' };
  });

  protected readonly approveTitle = computed(() => {
    const d = this.store.detail();
    if (d?.isMine) {
      return "GitHub doesn't allow approving your own pull request";
    }
    if (d?.approvedByMe) {
      return 'You approved this pull request';
    }
    return 'Approve this pull request on GitHub';
  });

  constructor() {
    effect(() => this.store.load({ owner: this.owner(), repo: this.repo(), number: this.number() }));
  }
}
