import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PrStage } from '@pr-manager/contracts';
import { StageStateIconComponent } from '../stage-state-icon/stage-state-icon.component';

/** ADO's "All Stages" side list. Picking a stage selects it in the graph. */
@Component({
  selector: 'app-stage-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StageStateIconComponent],
  template: `
    <div class="head">
      <span>All Stages</span>
      <button type="button" class="collapse" title="Hide stage list" aria-label="Hide stage list" (click)="collapse.emit()">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M8.5 4L4.5 8l4 4M12.5 4l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
    <ul>
      @for (stage of stages(); track stage.id) {
        <li>
          <button type="button" [class.selected]="stage.id === selectedId()" [title]="stage.name" (click)="select.emit(stage.id)">
            <app-stage-state-icon [state]="stage.state" />
            <span>{{ stage.name }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border); }
    .head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px 10px 16px; font-weight: 600; color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    }
    .collapse {
      display: inline-flex; padding: 4px; color: var(--text-secondary);
      background: none; border: none; border-radius: 2px; cursor: pointer;
    }
    .collapse:hover { background: var(--surface-hover); }
    ul { flex: 1; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
    li + li { border-top: 1px solid var(--border); }
    li button {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 16px;
      font: inherit; color: var(--text); text-align: left; background: none; border: none; cursor: pointer;
    }
    li button span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    li button:hover { background: var(--surface-hover); }
    li button.selected { background: var(--surface-selected); }
  `,
})
export class StageListComponent {
  readonly stages = input.required<PrStage[]>();
  readonly selectedId = input<string | null>(null);
  readonly select = output<string>();
  readonly collapse = output<void>();
}
