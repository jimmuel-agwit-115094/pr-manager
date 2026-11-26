import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Repo } from '@pr-manager/contracts';

@Component({
  selector: 'app-repo-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label for="repo-picker">Repository</label>
    <select id="repo-picker" [value]="selectedKey() ?? ''" (change)="onChange($event)">
      <option value="">Choose repo…</option>
      @for (repo of repos(); track repo.owner + '/' + repo.name) {
        <option [value]="repo.owner + '/' + repo.name">{{ repo.displayName }}</option>
      }
    </select>
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 12px; }
    label { font-weight: 600; color: var(--text-secondary); }
    select {
      appearance: none;
      min-width: 240px;
      height: 32px;
      padding: 0 32px 0 12px;
      font: inherit;
      font-weight: 600;
      color: var(--text);
      border: none;
      border-radius: 2px;
      background: var(--neutral-fill)
        url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="%23333" stroke-width="1.3"/></svg>')
        no-repeat right 12px center;
      cursor: pointer;
    }
    select:hover { background-color: var(--neutral-fill-hover); }
  `,
})
export class RepoPickerComponent {
  readonly repos = input.required<Repo[]>();
  readonly selectedKey = input<string | null>(null);
  readonly selectedKeyChange = output<string | null>();

  protected onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedKeyChange.emit(value || null);
  }
}
