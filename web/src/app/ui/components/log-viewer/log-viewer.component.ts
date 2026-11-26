import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, input, signal, untracked, viewChild } from '@angular/core';
import { logLineKind } from '../../../services/build.store';

/** ADO-style dark log console: line numbers, coloured ##[error] / ##[warning] / ##[section] lines. */
@Component({
  selector: 'app-log-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errorLines().length) {
      <div class="jump" role="toolbar" aria-label="Errors in this log">
        <span>{{ errorLines().length }} error line{{ errorLines().length === 1 ? '' : 's' }}</span>
        <button type="button" (click)="jump(-1)" aria-label="Previous error">↑</button>
        <button type="button" (click)="jump(1)" aria-label="Next error">↓</button>
      </div>
    }
    <div class="scroll" #scroll tabindex="0" [attr.aria-label]="label()">
      @if (truncated()) {
        <p class="note">Only the last {{ lines().length }} lines are shown. Open the build in Azure DevOps for the full log.</p>
      }
      <pre><code>@for (row of rows(); track $index) {<span class="line {{ row.kind }}" [class.current]="$index === current()" [attr.data-line]="$index"><span class="no">{{ $index + 1 }}</span>{{ row.text }}
</span>}</code></pre>
    </div>
  `,
  styles: `
    :host { position: relative; display: flex; flex-direction: column; min-height: 0; background: var(--log-bg); color: var(--log-text); }
    .scroll { position: relative; flex: 1; min-height: 0; overflow: auto; padding: 8px 0; }
    pre { margin: 0; font: 13px/20px Consolas, 'Cascadia Mono', Menlo, monospace; }
    .line { display: block; padding-right: 16px; white-space: pre; }
    .line.current { background: var(--log-highlight); }
    .no { display: inline-block; width: 64px; padding-right: 16px; color: var(--log-muted); text-align: right; user-select: none; }
    .error { color: var(--log-error); }
    .warning { color: var(--log-warning); }
    .section { color: var(--log-section); }
    .command { color: var(--log-command); }
    .note { margin: 0 16px 8px; color: var(--log-muted); font-size: 12px; }
    .jump {
      position: absolute; z-index: 1; top: 8px; right: 20px; display: flex; align-items: center; gap: 4px;
      padding: 2px 4px 2px 10px; font-size: 12px; background: var(--log-toolbar); border-radius: 2px;
    }
    .jump button { padding: 2px 8px; font: inherit; color: var(--log-text); background: none; border: none; cursor: pointer; }
    .jump button:hover { background: var(--log-highlight); }
  `,
})
export class LogViewerComponent {
  readonly lines = input.required<string[]>();
  readonly truncated = input(false);
  readonly label = input('Log');

  private readonly scroll = viewChild.required<ElementRef<HTMLElement>>('scroll');

  /** Lines keep their `##[error]` markers, as in ADO's log view. */
  protected readonly rows = computed(() => this.lines().map((text) => ({ kind: logLineKind(text), text })));
  protected readonly errorLines = computed(() => this.rows().flatMap((r, i) => (r.kind === 'error' ? [i] : [])));
  protected readonly current = signal<number | null>(null);

  constructor() {
    // A new log opens at its first error (what you're here for), else at the end.
    afterRenderEffect(() => {
      const errors = this.errorLines();
      const count = this.rows().length;
      untracked(() => {
        const target = errors[0] ?? null;
        this.current.set(target);
        this.scrollTo(target ?? count - 1, target !== null);
      });
    });
  }

  protected jump(step: 1 | -1): void {
    const errors = this.errorLines();
    if (!errors.length) {
      return;
    }
    const at = errors.indexOf(this.current() ?? -1);
    const next = errors[(at + step + errors.length) % errors.length]!;
    this.current.set(next);
    this.scrollTo(next, true);
  }

  /** Scrolls only the log box (scrollIntoView would also move the page). */
  private scrollTo(index: number, center: boolean): void {
    const box = this.scroll().nativeElement;
    const el = box.querySelector<HTMLElement>(`[data-line="${index}"]`);
    if (el) {
      box.scrollTop = center ? el.offsetTop - box.clientHeight / 2 : el.offsetTop + el.offsetHeight - box.clientHeight;
    }
  }
}
