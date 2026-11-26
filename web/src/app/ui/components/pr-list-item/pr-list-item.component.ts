import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PullRequestSummary } from '@pr-manager/contracts';
import { CiStatusDotComponent } from '../ci-status-dot/ci-status-dot.component';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';

@Component({
  selector: 'app-pr-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CiStatusDotComponent, TimeAgoPipe, RouterLink],
  template: `
    @let p = pr();
    @if (p.authorAvatar) {
      <img class="avatar" [src]="p.authorAvatar" alt="" width="32" height="32" />
    } @else {
      <span class="avatar avatar--initial" aria-hidden="true">{{ p.author.charAt(0).toUpperCase() }}</span>
    }
    <div class="main">
      <div class="line1">
        @if (link(); as route) {
          <a class="title" [routerLink]="route">{{ p.title }}</a>
        } @else {
          <a class="title" [href]="p.url" target="_blank" rel="noopener">{{ p.title }}</a>
        }
        <a class="external" [href]="p.url" target="_blank" rel="noopener" title="Open on GitHub" aria-label="Open #{{ p.number }} on GitHub">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M9 2h5v5M14 2L7.5 8.5M12 9.5V14H2V4h4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
        @if (p.isMine) { <span class="pill pill--mine">Mine</span> }
        @if (p.isDraft) { <span class="pill pill--draft">Draft</span> }
        @if (p.hasConflicts) { <span class="pill pill--conflict">Conflicts</span> }
      </div>
      <div class="line2">
        <span class="number">#{{ p.number }}</span>
        <span>{{ p.author }}</span>
        <span class="sep">·</span>
        <span class="branch" [title]="p.branch + ' into ' + p.target">
          <span class="ref">{{ p.branch }}</span> into <span class="ref">{{ p.target }}</span>
        </span>
      </div>
    </div>
    <div class="meta">
      @if (p.commentCount > 0) {
        <span class="comments" [attr.aria-label]="p.commentCount + ' comments'" [title]="p.commentCount + ' comments'">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M2 2.5h12v8.5H6.5L3.5 14v-3H2z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
          </svg>
          {{ p.commentCount }}
        </span>
      }
      <span class="updated" [title]="p.updatedAt">{{ p.updatedAt | timeAgo }}</span>
      <app-ci-status-dot [state]="p.ciState" />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      border-bottom: 1px solid var(--border);
    }
    :host(:last-child) { border-bottom: none; }
    :host(:hover) { background: var(--surface-hover); }

    .avatar {
      flex: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }
    .avatar--initial {
      display: grid;
      place-items: center;
      font-weight: 600;
      color: #fff;
      background: #8764b8;
    }

    .main { flex: 1; min-width: 0; }
    .line1 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .title {
      font-weight: 600;
      color: var(--text);
      text-decoration: none;
    }
    .title:hover { color: var(--link); text-decoration: underline; }
    .external { display: inline-flex; color: var(--muted); }
    .external:hover { color: var(--link); }

    .line2 {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .sep { color: var(--muted); }
    .branch { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ref { color: var(--link); }

    .pill {
      padding: 0 8px;
      font-size: 12px;
      font-weight: 600;
      line-height: 20px;
      border-radius: 10px;
    }
    .pill--mine { color: #fff; background: var(--primary); }
    .pill--draft { color: var(--text); background: var(--neutral-fill); }
    .pill--conflict { color: var(--bad-text); background: var(--bad-bg); }

    .meta {
      display: flex;
      flex: none;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .comments { display: inline-flex; align-items: center; gap: 4px; }
    .updated { min-width: 72px; text-align: right; }

    @media (max-width: 600px) {
      :host { align-items: flex-start; padding: 10px 16px; }
      .updated { display: none; }
    }
  `,
})
export class PrListItemComponent {
  readonly pr = input.required<PullRequestSummary>();
  /** In-app detail route. Without it the title links to GitHub. */
  readonly link = input<string[] | null>(null);
}
