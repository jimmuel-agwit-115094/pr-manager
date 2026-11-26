import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../../../../services/current-user.store';
import { overallStatusLine, PrDetailStore } from '../../../../../services/pr-detail.store';
import { ReviewThreadsStore, lastActivity, statusKey, type ThreadFilter } from '../../../../../services/review-threads.store';
import { CiStatusDotComponent } from '../../../../components/ci-status-dot/ci-status-dot.component';
import { CodeSnippetComponent } from '../../../../components/code-snippet/code-snippet.component';
import { ReviewThreadComponent } from '../../../../components/review-thread/review-thread.component';
import { StatusRowComponent } from '../../../../components/status-row/status-row.component';

const FILTERS: { value: ThreadFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
];

@Component({
  selector: 'app-pr-overview-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, StatusRowComponent, CiStatusDotComponent, CodeSnippetComponent, ReviewThreadComponent],
  providers: [ReviewThreadsStore],
  templateUrl: './pr-overview.tab.html',
  styleUrl: './pr-overview.tab.scss',
})
export class PrOverviewTab {
  protected readonly store = inject(PrDetailStore);
  protected readonly review = inject(ReviewThreadsStore);
  protected readonly currentUser = inject(CurrentUserStore);
  protected readonly filters = FILTERS;
  protected readonly statusKey = statusKey;
  protected readonly lastActivity = lastActivity;

  /**
   * Required: pipeline, merge conflicts, comments, and approvals when the branch requires reviews.
   * Approvals are optional when GitHub reports no review requirement.
   */
  protected readonly overall = computed(() =>
    overallStatusLine([
      { line: this.store.pipelineStatus(), required: true },
      { line: this.store.approvalStatus(), required: (this.store.detail()?.reviewDecision ?? 'NONE') !== 'NONE' },
      { line: this.store.conflictStatus(), required: true },
      { line: this.review.statusLine(), required: true },
    ]),
  );
}
