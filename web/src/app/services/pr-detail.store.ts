import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { ApiError, CiState, PipelineState, PrPipeline, PullRequestDetail } from '@pr-manager/contracts';
import { firstValueFrom, type Observable } from 'rxjs';
import { toApiError } from '../data-access/api-error';
import { PipelineApi } from '../data-access/pipeline.api';
import { PullRequestApi, type PrKey } from '../data-access/pull-request.api';
import { buildFileTree, filesInTreeOrder } from './file-tree';

export type PrAction = 'approve' | 'queue' | 'requeue';
export const PIPELINE_POLL_MS = 15_000;
/** After Queue/Requeue, keep polling this long for Azure Pipelines to pick up the `/azp run` comment. */
export const RUN_REQUEST_WINDOW_MS = 3 * 60_000;

export interface StatusLine {
  state: CiState;
  title: string;
  subtitle?: string;
}

/** PR detail state for one page instance. Provided by the detail page, shared with its tabs. */
@Injectable()
export class PrDetailStore {
  private readonly prApi = inject(PullRequestApi);
  private readonly pipelineApi = inject(PipelineApi);

  readonly key = signal<PrKey | null>(null);

  private readonly detailResource = rxResource({
    params: () => this.key() ?? undefined,
    stream: ({ params }) => this.prApi.get(params),
  });

  private readonly pipelineResource = rxResource({
    params: () => this.key() ?? undefined,
    stream: ({ params }) => this.pipelineApi.get(params),
  });

  /** Files load only once the Files Changed tab asks for them, then stay cached for this PR. */
  private readonly filesRequested = signal(false);
  private readonly filesResource = rxResource({
    params: () => (this.filesRequested() ? (this.key() ?? undefined) : undefined),
    stream: ({ params }) => this.prApi.files(params),
  });

  readonly files = computed(() => (this.filesResource.hasValue() ? this.filesResource.value() : null));
  readonly filesLoading = this.filesResource.isLoading;
  readonly filesError = computed(() => (this.filesResource.error() ? toApiError(this.filesResource.error()) : null));
  readonly fileTree = computed(() => buildFileTree(this.files()?.files ?? []));
  readonly orderedFiles = computed(() => filesInTreeOrder(this.fileTree()));

  /** File picked in the tree; defaults to the first file in tree order. */
  private readonly pickedFilePath = signal<string | null>(null);
  readonly selectedFile = computed(() => {
    const files = this.orderedFiles();
    return files.find((f) => f.path === this.pickedFilePath()) ?? files[0] ?? null;
  });

  private readonly fileViewResource = rxResource({
    params: () => {
      const key = this.key();
      const path = this.selectedFile()?.path;
      return key && path ? { key, path } : undefined;
    },
    stream: ({ params }) => this.prApi.fileView(params.key, params.path),
  });

  /** Only the view of the currently selected file (never a stale one while the next loads). */
  readonly fileView = computed(() => {
    const view = this.fileViewResource.hasValue() ? this.fileViewResource.value() : null;
    return view && view.path === this.selectedFile()?.path ? view : null;
  });
  readonly fileViewError = computed(() => (this.fileViewResource.error() ? toApiError(this.fileViewResource.error()) : null));

  readonly detail = computed(() => (this.detailResource.hasValue() ? this.detailResource.value() : null));
  readonly detailLoading = this.detailResource.isLoading;
  readonly detailError = computed(() => (this.detailResource.error() ? toApiError(this.detailResource.error()) : null));

  readonly pipeline = computed(() => (this.pipelineResource.hasValue() ? this.pipelineResource.value() : null));
  readonly pipelineLoading = this.pipelineResource.isLoading;
  readonly pipelineError = computed(() => (this.pipelineResource.error() ? toApiError(this.pipelineResource.error()) : null));

  /** Action in flight, and the last action error (cleared on the next action). */
  readonly busy = signal<PrAction | null>(null);
  readonly actionError = signal<ApiError | null>(null);

  readonly canApprove = computed(() => {
    const d = this.detail();
    return !!d && d.state === 'OPEN' && !d.isMine && !d.approvedByMe;
  });

  /** Set after Queue/Requeue succeeds; cleared once the pipeline state changes or the window passes. */
  readonly runRequested = signal<{ at: number; fromState: PipelineState } | null>(null);

  readonly pipelineStatus = computed<StatusLine>(() =>
    pipelineStatusLine(this.pipeline(), this.pipelineError(), this.runRequested() !== null),
  );

  /** Only one pipeline button is shown: Queue before the first run, Requeue after. */
  readonly pipelineAction = computed(() => this.pipeline()?.action ?? null);
  readonly canRunPipeline = computed(
    () => !!this.pipeline()?.canRun && this.detail()?.state === 'OPEN' && this.runRequested() === null && this.busy() === null,
  );
  readonly approvalStatus = computed<StatusLine | null>(() => approvalStatusLine(this.detail()));
  readonly conflictStatus = computed<StatusLine | null>(() => conflictStatusLine(this.detail()));

  constructor() {
    // Clear the "run requested" marker once GitHub shows the new run (state changed) or the window passes.
    effect(() => {
      const requested = this.runRequested();
      const state = this.pipeline()?.state;
      if (requested && (state !== requested.fromState || Date.now() - requested.at > RUN_REQUEST_WINDOW_MS)) {
        this.runRequested.set(null);
      }
    });

    // Poll while a run is in progress or was just requested, so the status updates without a refresh.
    effect((onCleanup) => {
      const running = this.pipeline()?.state === 'RUNNING';
      if (!running && !this.runRequested()) {
        return;
      }
      const timer = setTimeout(() => this.pipelineResource.reload(), PIPELINE_POLL_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  load(key: PrKey): void {
    const current = this.key();
    if (!current || current.owner !== key.owner || current.repo !== key.repo || current.number !== key.number) {
      this.actionError.set(null);
      this.runRequested.set(null);
      this.pickedFilePath.set(null);
      this.key.set(key);
    }
  }

  refresh(): void {
    this.detailResource.reload();
    this.pipelineResource.reload();
    if (this.filesRequested()) {
      this.filesResource.reload();
    }
  }

  /** Called by the Files Changed tab. No-op after the first call. */
  loadFiles(): void {
    this.filesRequested.set(true);
  }

  reloadFiles(): void {
    this.filesResource.reload();
    this.fileViewResource.reload();
  }

  selectFile(path: string): void {
    this.pickedFilePath.set(path);
  }

  approve(): Promise<void> {
    return this.run('approve', (key) => this.prApi.approve(key), (d) => this.detailResource.set(d));
  }

  /** Posts `/azp run` on the PR; Azure Pipelines starts the run a few seconds later. */
  queue(): Promise<void> {
    return this.run('queue', (key) => this.pipelineApi.queue(key), (p) => this.markRunRequested(p));
  }

  requeue(): Promise<void> {
    return this.run('requeue', (key) => this.pipelineApi.requeue(key), (p) => this.markRunRequested(p));
  }

  private markRunRequested(pipeline: PrPipeline): void {
    this.pipelineResource.set(pipeline);
    this.runRequested.set({ at: Date.now(), fromState: pipeline.state });
  }

  private async run<T>(action: PrAction, call: (key: PrKey) => Observable<T>, apply: (value: T) => void): Promise<void> {
    const key = this.key();
    if (!key || this.busy()) {
      return;
    }
    this.busy.set(action);
    this.actionError.set(null);
    try {
      apply(await firstValueFrom(call(key)));
    } catch (err) {
      this.actionError.set(toApiError(err));
    } finally {
      this.busy.set(null);
    }
  }
}

const PIPELINE_LINES: Record<PipelineState, StatusLine> = {
  NOT_QUEUED: { state: 'NONE', title: 'Pipeline not queued', subtitle: 'No Azure Pipelines run on this PR yet.' },
  RUNNING: { state: 'PENDING', title: 'Pipeline running' },
  SUCCEEDED: { state: 'SUCCESS', title: 'Pipeline succeeded' },
  FAILED: { state: 'FAILURE', title: 'Pipeline failed' },
  CANCELED: { state: 'NONE', title: 'Pipeline canceled' },
};

export function pipelineStatusLine(pipeline: PrPipeline | null, error: ApiError | null, runRequested = false): StatusLine {
  if (error) {
    return { state: 'NONE', title: 'Pipeline status unavailable', subtitle: error.message };
  }
  if (!pipeline) {
    return { state: 'PENDING', title: 'Loading pipeline status…' };
  }
  if (runRequested) {
    return { state: 'PENDING', title: 'Run requested', subtitle: 'Waiting for Azure Pipelines to start…' };
  }
  const line = PIPELINE_LINES[pipeline.state];
  return pipeline.pipelines.length && !line.subtitle ? { ...line, subtitle: pipeline.pipelines.join(', ') } : line;
}

export function approvalStatusLine(detail: PullRequestDetail | null): StatusLine | null {
  if (!detail) {
    return null;
  }
  const count = `${detail.approvalCount} approval${detail.approvalCount === 1 ? '' : 's'}`;
  switch (detail.reviewDecision) {
    case 'APPROVED':
      return { state: 'SUCCESS', title: 'All required approvals approved', subtitle: count };
    case 'CHANGES_REQUESTED':
      return { state: 'FAILURE', title: 'Changes requested', subtitle: count };
    case 'REVIEW_REQUIRED':
      return { state: 'PENDING', title: 'Waiting for required approvals', subtitle: count };
    default:
      return { state: detail.approvalCount > 0 ? 'SUCCESS' : 'NONE', title: 'No required reviewers', subtitle: count };
  }
}

/** One row that feeds the overall status. Missing rows (still loading) count as pending. */
export interface PolicyCheck {
  line: StatusLine | null;
  required: boolean;
}

const plural = (n: number, word: string): string => `${word}${n === 1 ? '' : 's'}`;

/**
 * The ADO-style summary at the top of the Overview: has every required check passed?
 * A required row passes only on SUCCESS; FAILURE and NONE (not run, unavailable) count as failed.
 */
export function overallStatusLine(checks: readonly PolicyCheck[]): StatusLine {
  const required = checks.filter((c) => c.required).map((c) => c.line?.state ?? 'PENDING');
  const optional = checks.filter((c) => !c.required).map((c) => c.line?.state ?? 'PENDING');

  const failed = required.filter((s) => s === 'FAILURE' || s === 'NONE').length;
  const pending = required.filter((s) => s === 'PENDING').length;
  const n = required.length;

  let line: StatusLine;
  if (failed) {
    line = { state: 'FAILURE', title: `${failed} of ${n} required ${plural(n, 'check')} failed` };
  } else if (pending) {
    line = { state: 'PENDING', title: `${pending} of ${n} required ${plural(n, 'check')} pending` };
  } else {
    line = { state: 'SUCCESS', title: n === 0 ? 'No required checks' : n === 1 ? 'Required check succeeded' : 'All required checks succeeded' };
  }

  if (optional.length) {
    const ok = optional.filter((s) => s === 'SUCCESS').length;
    line.subtitle =
      ok === optional.length
        ? `Optional ${plural(optional.length, 'check')} succeeded`
        : `${ok} of ${optional.length} optional ${plural(optional.length, 'check')} succeeded`;
  }
  return line;
}

export function conflictStatusLine(detail: PullRequestDetail | null): StatusLine | null {
  if (!detail) {
    return null;
  }
  switch (detail.mergeable) {
    case 'MERGEABLE':
      return { state: 'SUCCESS', title: 'No merge conflicts' };
    case 'CONFLICTING':
      return { state: 'FAILURE', title: 'Merge conflicts', subtitle: `Resolve conflicts with ${detail.target} before merging.` };
    default:
      return { state: 'PENDING', title: 'Checking for merge conflicts' };
  }
}
