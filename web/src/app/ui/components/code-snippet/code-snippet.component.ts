import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DiffLine } from '@pr-manager/contracts';
import { fileBadge } from '../../../services/file-tree';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

/** ADO-style file header plus a few diff lines: the code a review thread was written on. */
@Component({
  selector: 'app-code-snippet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimeAgoPipe],
  template: `
    <header class="file">
      <span class="badge" aria-hidden="true">{{ badge() }}</span>
      <span class="names">
        <span class="name">{{ fileName() }}</span>
        <span class="path">/{{ path() }}</span>
      </span>
      <span class="aside">
        @if (line() !== null) {
          <span>line {{ line() }}</span>
        }
        @if (date(); as d) {
          <span [title]="d">{{ d | timeAgo }}</span>
        }
      </span>
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
    .file { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
    .badge {
      display: inline-flex; flex: none; align-items: center; justify-content: center; width: 32px; height: 32px;
      font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--neutral-fill); border-radius: 50%;
    }
    .names { display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 15px; font-weight: 600; }
    .path { font-size: 12px; color: var(--text-secondary); overflow-wrap: anywhere; }
    .aside { display: flex; gap: 16px; margin-left: auto; font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
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
  /** ISO time shown on the right, e.g. the thread's latest comment. */
  readonly date = input<string | null>(null);

  protected readonly fileName = computed(() => this.path().slice(this.path().lastIndexOf('/') + 1));
  protected readonly badge = computed(() => fileBadge(this.path()) ?? this.fileName().slice(0, 2).toUpperCase());
}
