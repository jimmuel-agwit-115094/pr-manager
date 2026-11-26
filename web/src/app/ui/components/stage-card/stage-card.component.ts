import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { ApiError, PrStage } from '@pr-manager/contracts';
import { formatDuration } from '../../../services/build.store';
import { StageStateIconComponent } from '../stage-state-icon/stage-state-icon.component';

/** ADO-style stage card: state and duration; expanded, its jobs and a "Rerun just this stage" split button. */
@Component({
  selector: 'app-stage-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StageStateIconComponent],
  host: {
    '[class.expanded]': 'expanded()',
    '[class.selected]': 'selected()',
    '(keydown.escape)': 'menuOpen.set(false)',
  },
  templateUrl: './stage-card.component.html',
  styleUrl: './stage-card.component.scss',
})
export class StageCardComponent {
  readonly stage = input.required<PrStage>();
  /** Shows the jobs and the rerun button. */
  readonly expanded = input(false);
  readonly selected = input(false);
  /** False when the PR isn't open, so reruns aren't offered. */
  readonly canRerun = input(true);
  /** This stage's rerun is in flight. */
  readonly busy = input(false);
  /** Another rerun is in flight; buttons are disabled. */
  readonly disabled = input(false);
  readonly error = input<ApiError | null>(null);

  /** Header clicked: select the stage and expand / collapse it. */
  readonly toggle = output<void>();
  /** allJobs=false reruns only the failed jobs; true reruns every job in the stage. */
  readonly rerun = output<boolean>();

  protected readonly menuOpen = signal(false);
  protected readonly formatDuration = formatDuration;

  protected readonly jobSummary = computed(() => {
    const jobs = this.stage().jobs;
    if (!jobs.length) {
      return this.stage().state === 'SKIPPED' ? 'Skipped' : 'Not started';
    }
    const done = jobs.filter((j) => j.state !== 'RUNNING' && j.state !== 'NOT_STARTED').length;
    const noun = jobs.length === 1 ? 'job' : 'jobs';
    return done === jobs.length ? `${jobs.length} ${noun} completed` : `${done}/${jobs.length} ${noun} completed`;
  });

  protected emit(allJobs: boolean): void {
    this.menuOpen.set(false);
    this.rerun.emit(allJobs);
  }
}
