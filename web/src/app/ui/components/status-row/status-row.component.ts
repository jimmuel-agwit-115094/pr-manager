import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CiState } from '@pr-manager/contracts';
import { CiStatusDotComponent } from '../ci-status-dot/ci-status-dot.component';

/** ADO-style policy row: status icon, title, optional subtitle, actions on the right, details below. */
@Component({
  selector: 'app-status-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CiStatusDotComponent],
  template: `
    <div class="row">
      <app-ci-status-dot class="icon" [state]="state()" />
      <div class="text">
        <div class="title">{{ title() }}</div>
        @if (subtitle()) {
          <div class="subtitle">{{ subtitle() }}</div>
        }
        <ng-content select="[statusLinks]" />
      </div>
      <div class="actions"><ng-content select="[statusActions]" /></div>
    </div>
    <ng-content />
  `,
  styles: `
    :host { display: block; padding: 14px 20px; border-bottom: 1px solid var(--border); }
    :host(:last-child) { border-bottom: none; }
    .row { display: flex; align-items: flex-start; gap: 12px; }
    .icon { margin-top: 2px; }
    .text { flex: 1; min-width: 0; }
    .title { font-weight: 600; }
    .subtitle { font-size: 12px; color: var(--text-secondary); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .actions:empty { display: none; }
  `,
})
export class StatusRowComponent {
  readonly state = input.required<CiState>();
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>();
}
