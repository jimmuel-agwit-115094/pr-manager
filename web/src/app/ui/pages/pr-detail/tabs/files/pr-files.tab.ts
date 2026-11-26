import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import type { PrFileChange, PrFileView } from '@pr-manager/contracts';
import { CurrentUserStore } from '../../../../../services/current-user.store';
import { splitPath } from '../../../../../services/file-tree';
import { buildLineRows, collapseUnchanged, type ViewRow } from '../../../../../services/file-view-rows';
import { PrDetailStore } from '../../../../../services/pr-detail.store';
import { ReviewThreadsStore, statusKey } from '../../../../../services/review-threads.store';
import { CommentBoxComponent } from '../../../../components/comment-box/comment-box.component';
import { ReviewThreadComponent } from '../../../../components/review-thread/review-thread.component';

/** Rows rendered per step; huge added files grow by this much on "Show more". */
const RENDER_STEP = 1500;

/** Short text icons by extension, ADO-style (M↓ for Markdown, C# for C#). */
const FILE_BADGES: Record<string, string> = {
  md: 'M↓',
  cs: 'C#',
  ts: 'TS',
  js: 'JS',
  json: '{}',
  html: '<>',
  scss: '#',
  css: '#',
  yml: 'Y',
  yaml: 'Y',
  csproj: 'C#',
  sql: 'DB',
};

const STATUS_MARKS: Partial<Record<PrFileChange['status'], { mark: string; title: string }>> = {
  added: { mark: '+', title: 'Added' },
  removed: { mark: '−', title: 'Deleted' },
  renamed: { mark: 'R', title: 'Renamed' },
  copied: { mark: 'C', title: 'Copied' },
};

export function fileBadge(path: string): string | null {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return path.includes('.') ? (FILE_BADGES[ext] ?? null) : null;
}

/** Files Changed: folder tree on the left; the selected file, whole, with its changes marked on the right. */
@Component({
  selector: 'app-pr-files-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, CommentBoxComponent, ReviewThreadComponent],
  providers: [ReviewThreadsStore],
  templateUrl: './pr-files.tab.html',
  styleUrl: './pr-files.tab.scss',
})
export class PrFilesTab {
  protected readonly store = inject(PrDetailStore);
  protected readonly review = inject(ReviewThreadsStore);
  protected readonly currentUser = inject(CurrentUserStore);

  /** Threads of the selected file. */
  private readonly fileThreads = computed(() => {
    const path = this.store.selectedFile()?.path;
    return path ? this.review.byPath().get(path) : undefined;
  });
  /** Threads GitHub has no line for at all; everything else is placed in the code. */
  protected readonly unplacedThreads = computed(() => this.fileThreads()?.unplaced ?? []);

  /**
   * The full view once loaded; until then the diff hunks already in the file list, so the file
   * shows instantly instead of waiting on GitHub.
   */
  protected readonly view = computed<(PrFileView & { pending: boolean }) | null>(() => {
    const file = this.store.selectedFile();
    if (!file) {
      return null;
    }
    const full = this.store.fileView();
    return full ? { ...full, pending: false } : { path: file.path, lines: file.lines, isFullFile: false, pending: true };
  });

  /** Gap starts the user expanded, for the current view. */
  protected readonly expandedGaps = signal<ReadonlySet<number>>(new Set());
  protected readonly renderLimit = signal(RENDER_STEP);

  private readonly allRows = computed<ViewRow[]>(() => {
    const view = this.view();
    if (!view) {
      return [];
    }
    const rows = buildLineRows(view.path, view.lines, this.fileThreads(), this.review.draft());
    return collapseUnchanged(rows, this.expandedGaps());
  });
  protected readonly rows = computed(() => this.allRows().slice(0, this.renderLimit()));
  protected readonly hiddenRowCount = computed(() => Math.max(0, this.allRows().length - this.renderLimit()));

  protected readonly collapsedFolders = signal<ReadonlySet<string>>(new Set());
  private readonly viewer = viewChild<ElementRef<HTMLElement>>('viewer');

  protected readonly totals = computed(() =>
    this.store.orderedFiles().reduce(
      (t, f) => ({ additions: t.additions + f.additions, deletions: t.deletions + f.deletions }),
      { additions: 0, deletions: 0 },
    ),
  );

  /** Added and deleted files show one line-number column and no highlight, like ADO. */
  protected readonly singleColumn = computed(() => {
    const status = this.store.selectedFile()?.status;
    return status === 'added' || status === 'removed';
  });

  protected readonly splitPath = splitPath;
  protected readonly statusKey = statusKey;
  protected readonly fileBadge = fileBadge;
  protected statusMark(file: PrFileChange): { mark: string; title: string } | null {
    return STATUS_MARKS[file.status] ?? null;
  }

  constructor() {
    this.store.loadFiles();
    // A newly selected file starts at its top, with no comment box left open from the previous one.
    effect(() => {
      this.store.selectedFile();
      this.viewer()?.nativeElement.scrollTo({ top: 0 });
      untracked(() => this.review.cancel());
    });
    // Gap indexes belong to one view (hunks → full file changes them), so reset per view.
    effect(() => {
      this.view()?.isFullFile;
      this.store.selectedFile();
      this.expandedGaps.set(new Set());
      this.renderLimit.set(RENDER_STEP);
    });
  }

  protected expandGap(start: number): void {
    this.expandedGaps.update((set) => new Set(set).add(start));
  }

  protected showMore(): void {
    this.renderLimit.update((n) => n + RENDER_STEP);
  }

  protected toggleFolder(path: string): void {
    this.collapsedFolders.update((set) => {
      const next = new Set(set);
      if (!next.delete(path)) {
        next.add(path);
      }
      return next;
    });
  }
}
