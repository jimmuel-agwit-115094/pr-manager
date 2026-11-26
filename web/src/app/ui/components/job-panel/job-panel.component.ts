import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ApiError, PrBuildLog, PrJob, PrTask } from '@pr-manager/contracts';
import { formatDuration } from '../../../services/build.store';
import { LogViewerComponent } from '../log-viewer/log-viewer.component';
import { StageStateIconComponent } from '../stage-state-icon/stage-state-icon.component';

/** ADO's job view: the job's steps on the left, the picked step's issues and log on the right. */
@Component({
  selector: 'app-job-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogViewerComponent, StageStateIconComponent],
  templateUrl: './job-panel.component.html',
  styleUrl: './job-panel.component.scss',
})
export class JobPanelComponent {
  readonly job = input.required<PrJob>();
  readonly stageName = input('');
  readonly task = input<PrTask | null>(null);
  readonly log = input<PrBuildLog | null>(null);
  readonly logLoading = input(false);
  readonly logError = input<ApiError | null>(null);
  /** ADO link for "open in Azure DevOps". */
  readonly buildUrl = input('');

  readonly back = output<void>();
  readonly selectTask = output<string>();
  readonly retryLog = output<void>();

  protected readonly formatDuration = formatDuration;
  protected readonly errors = computed(() => this.task()?.issues ?? []);
}
