import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BuildStore, buildKey } from '../../../../../services/build.store';
import { StageGraphComponent } from '../../../../components/stage-graph/stage-graph.component';
import { StageListComponent } from '../../../../components/stage-list/stage-list.component';
import { StageStateIconComponent } from '../../../../components/stage-state-icon/stage-state-icon.component';

/** ADO-style stage view of the PR's Azure Pipelines builds, with stage and failed-job reruns. */
@Component({
  selector: 'app-pr-pipeline-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StageGraphComponent, StageListComponent, StageStateIconComponent],
  providers: [BuildStore],
  templateUrl: './pr-pipeline.tab.html',
  styleUrl: './pr-pipeline.tab.scss',
})
export class PrPipelineTab {
  protected readonly store = inject(BuildStore);
  protected readonly buildKey = buildKey;

  /** Selected stage per build. */
  private readonly selected = signal<Readonly<Record<number, string>>>({});
  protected readonly listHidden = signal(false);

  protected selectedOf(buildId: number): string | null {
    return this.selected()[buildId] ?? null;
  }

  protected selectStage(buildId: number, stageId: string): void {
    this.selected.update((s) => ({ ...s, [buildId]: stageId }));
  }
}
