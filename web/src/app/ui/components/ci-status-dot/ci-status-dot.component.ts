import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CiState } from '@pr-manager/contracts';

const LABELS: Record<CiState, string> = {
  SUCCESS: 'Checks passed',
  FAILURE: 'Checks failed',
  PENDING: 'Checks running',
  NONE: 'No checks',
};

/** ADO-style status icon: filled circle with a glyph. */
@Component({
  selector: 'app-ci-status-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[class]': '"dot dot--" + state().toLowerCase()',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
  },
  template: `
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      @switch (state()) {
        @case ('SUCCESS') {
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M4.5 8.2l2.3 2.3 4.7-4.9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        }
        @case ('FAILURE') {
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" />
        }
        @case ('PENDING') {
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="M8 4.2V8l2.6 1.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        }
        @default {
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M5 8h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; flex: none; }
    :host(.dot--success) { color: var(--ok); }
    :host(.dot--failure) { color: var(--bad); }
    :host(.dot--pending) { color: var(--pending); }
    :host(.dot--none) { color: var(--muted); }
  `,
})
export class CiStatusDotComponent {
  readonly state = input.required<CiState>();
  protected readonly label = computed(() => LABELS[this.state()]);
}
