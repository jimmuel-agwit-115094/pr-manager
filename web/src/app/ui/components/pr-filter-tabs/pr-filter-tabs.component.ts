import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PrFilter } from '@pr-manager/contracts';

const TABS: { value: PrFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'review', label: 'Review requested' },
];

@Component({
  selector: 'app-pr-filter-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist" aria-label="Pull request filter">
      @for (tab of tabs; track tab.value) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="filter() === tab.value"
          [class.active]="filter() === tab.value"
          (click)="filterChange.emit(tab.value)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
    <div class="search">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
        <path d="M10.2 10.2L15 15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
      <input
        type="search"
        placeholder="Filter pull requests"
        aria-label="Filter pull requests"
        [value]="search()"
        (input)="searchChange.emit($any($event.target).value)"
      />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      padding: 0 20px;
      border-bottom: 1px solid var(--border);
    }
    .tabs { display: flex; gap: 4px; }
    button {
      position: relative;
      height: 44px;
      padding: 0 8px;
      font: inherit;
      color: var(--text-secondary);
      background: none;
      border: none;
      cursor: pointer;
    }
    button:hover { color: var(--text); }
    button.active { color: var(--text); font-weight: 600; }
    button.active::after {
      content: '';
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 0;
      height: 2px;
      background: var(--primary);
    }
    .search {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 1 260px;
      height: 32px;
      margin-bottom: 6px;
      padding: 0 8px;
      color: var(--text-secondary);
      border: 1px solid var(--border-strong);
      border-radius: 2px;
      background: var(--surface);
    }
    .search:focus-within { border-color: var(--primary); }
    input {
      flex: 1;
      min-width: 0;
      font: inherit;
      color: var(--text);
      border: none;
      outline: none;
      background: transparent;
    }
  `,
})
export class PrFilterTabsComponent {
  protected readonly tabs = TABS;
  readonly filter = input.required<PrFilter>();
  readonly search = input('');
  readonly filterChange = output<PrFilter>();
  readonly searchChange = output<string>();
}
