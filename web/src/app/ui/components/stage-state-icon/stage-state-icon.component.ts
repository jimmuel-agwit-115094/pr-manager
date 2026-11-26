import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { StageState } from '@pr-manager/contracts';

const LABELS: Record<StageState, string> = {
  NOT_STARTED: 'Not started',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  WARNING: 'Succeeded with issues',
  FAILED: 'Failed',
  CANCELED: 'Canceled',
  SKIPPED: 'Skipped',
};

/** ADO-style icon for a stage or job state. */
@Component({
  selector: 'app-stage-state-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[class]': '"icon icon--" + state().toLowerCase()',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
  },
  template: `
    <svg viewBox="0 0 16 16" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      @switch (state()) {
        @case ('SUCCEEDED') {
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M4.5 8.2l2.3 2.3 4.7-4.9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('WARNING') {
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M8 4v5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="8" cy="11.8" r="1.1" fill="#fff" />
        }
        @case ('FAILED') {
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
        }
        @case ('RUNNING') {
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" />
          <path class="spin" d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        }
        @case ('CANCELED') {
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M4.8 8h6.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
        }
        @default {
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
        }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; flex: none; }
    :host(.icon--succeeded) { color: var(--ok); }
    :host(.icon--warning) { color: var(--warn); }
    :host(.icon--failed) { color: var(--bad); }
    :host(.icon--running) { color: var(--pending); }
    :host(.icon--canceled), :host(.icon--skipped), :host(.icon--not_started) { color: var(--muted); }
    .spin { transform-origin: 8px 8px; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  `,
})
export class StageStateIconComponent {
  readonly state = input.required<StageState>();
  readonly size = input(16);
  protected readonly label = computed(() => LABELS[this.state()]);
}
