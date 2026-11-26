import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DiffLine } from '@pr-manager/contracts';

/** ADO-style file header plus a few diff lines: the code a review thread was written on. */
@Component({
  selector: 'app-code-snippet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="file">
      <span class="name">{{ fileName() }}</span>
      <span class="path">/{{ path() }}</span>
      @if (line() !== null) {
        <span class="line">line {{ line() }}</span>
      }
    </header>
    @if (lines().length) {
      <table class="code" [attr.aria-label]="'Code at ' + path()">
        <tbody>
          @for (l of lines(); track $index) {
            <tr [class]="'row row--' + l.type">
              <td class="no">{{ l.oldLine ?? '' }}</td>
              <td class="no">{{ l.newLine ?? '' }}</td>
              <td class="mark" aria-hidden="true">{{ l.type === 'add' ? '+' : l.type === 'del' ? '−' : '' }}</td>
              <td class="text">{{ l.text }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    :host { display: block; }
    .file { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--border); }
    .name { font-weight: 600; }
    .path, .line { font-size: 12px; color: var(--text-secondary); overflow-wrap: anywhere; }
    .line { margin-left: auto; }
    .code { width: 100%; border-collapse: collapse; table-layout: fixed; font-family: 'Cascadia Mono', Consolas, monospace; font-size: 12px; line-height: 18px; }
    .no { width: 40px; padding: 0 6px; text-align: right; color: var(--muted); user-select: none; }
    .mark { width: 14px; color: var(--text-secondary); user-select: none; }
    .text { white-space: pre; overflow: hidden; text-overflow: ellipsis; }
    .row--add { background: var(--diff-add-bg); }
    .row--del { background: var(--diff-del-bg); }
    .row:last-child { box-shadow: inset 3px 0 0 var(--primary); }
  `,
})
export class CodeSnippetComponent {
  readonly path = input.required<string>();
  readonly line = input<number | null>(null);
  readonly lines = input<readonly DiffLine[]>([]);

  protected readonly fileName = computed(() => this.path().slice(this.path().lastIndexOf('/') + 1));
}
