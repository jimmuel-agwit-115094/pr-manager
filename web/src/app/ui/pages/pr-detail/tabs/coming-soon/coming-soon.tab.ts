import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const LABELS: Record<string, string> = {
  files: 'Files Changed',
  story: 'Story',
  commits: 'Commits',
  pipeline: 'Pipeline',
};

/** Placeholder for tabs scheduled for later phases. */
@Component({
  selector: 'app-coming-soon-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <p class="title">{{ label() }}</p>
      <p>This tab is coming in a later phase.</p>
    </div>
  `,
  styles: `
    .card {
      padding: 64px 20px;
      text-align: center;
      color: var(--text-secondary);
      background: var(--surface);
      border-radius: var(--radius);
      box-shadow: var(--shadow-card);
    }
    p { margin: 0; }
    .title { margin-bottom: 4px; font-size: 16px; font-weight: 600; color: var(--text); }
  `,
})
export class ComingSoonTab {
  /** From route data via withComponentInputBinding. */
  readonly tab = input('');
  protected readonly label = computed(() => LABELS[this.tab()] ?? 'This tab');
}
