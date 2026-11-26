import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { ApiError, PrBuild, PrTask, StageState } from '@pr-manager/contracts';
import { firstValueFrom, type Observable } from 'rxjs';
import { BuildApi } from '../data-access/build.api';
import { toApiError } from '../data-access/api-error';
import type { PrKey } from '../data-access/pull-request.api';
import { PrDetailStore } from './pr-detail.store';

export const BUILD_POLL_MS = 10_000;
/** After a rerun, keep polling this long for ADO to show the new attempt. */
export const RERUN_WINDOW_MS = 2 * 60_000;

/** Busy / error key: a whole build (`build:N`) or one stage (`stage:N:Identifier`). */
export const buildKey = (buildId: number): string => `build:${buildId}`;
export const stageKey = (buildId: number, stage: string): string => `stage:${buildId}:${stage}`;

const ACTIVE: ReadonlySet<StageState> = new Set(['RUNNING', 'NOT_STARTED']);

/** True while any build still has a stage running or waiting to start. */
export function anyActive(builds: readonly PrBuild[]): boolean {
  return builds.some((b) => ACTIVE.has(b.state));
}

/** Step to show first: the first failed one, then the first with warnings, else the last that logged. */
export function defaultTask(tasks: readonly PrTask[]): PrTask | null {
  return (
    tasks.find((t) => t.state === 'FAILED') ??
    tasks.find((t) => t.state === 'WARNING' || t.issues.some((i) => i.type === 'error')) ??
    [...tasks].reverse().find((t) => t.logId !== null) ??
    tasks[0] ??
    null
  );
}

export type LogLineKind = 'error' | 'warning' | 'section' | 'command' | 'plain';

/** Colour class for an ADO log line, from its `##[...]` marker. */
export function logLineKind(line: string): LogLineKind {
  if (line.startsWith('##[error]')) {
    return 'error';
  }
  if (line.startsWith('##[warning]')) {
    return 'warning';
  }
  if (line.startsWith('##[section]')) {
    return 'section';
  }
  return line.startsWith('##[command]') ? 'command' : 'plain';
}

export function formatDuration(ms: number | null): string {
  if (ms === null) {
    return '';
  }
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) {
    return `${h}h ${m}m`;
  }
  return m ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Pipeline tab state: the PR's Azure Pipelines builds with their stages, and the rerun actions.
 * Provided by the Pipeline tab, so it reloads each time the tab opens. Reruns are real ADO writes.
 */
@Injectable()
export class BuildStore {
  private readonly api = inject(BuildApi);
  private readonly detail = inject(PrDetailStore);

  private readonly resource = rxResource({
    params: () => this.detail.key() ?? undefined,
    stream: ({ params }) => this.api.list(params),
  });

  readonly builds = computed(() => (this.resource.hasValue() ? this.resource.value() : []));
  readonly loaded = computed(() => this.resource.hasValue());
  readonly loading = this.resource.isLoading;
  readonly error = computed(() => (this.resource.error() ? toApiError(this.resource.error()) : null));

  readonly canRerun = computed(() => this.detail.detail()?.state === 'OPEN');

  /** Action in flight (`buildKey` / `stageKey`), and the last failure with the key it belongs to. */
  readonly busy = signal<string | null>(null);
  readonly actionError = signal<{ key: string; error: ApiError } | null>(null);
  private readonly rerunAt = signal<number | null>(null);

  /** Job opened from a stage card (ADO's job view), and the step picked in it. */
  readonly openJob = signal<{ buildId: number; jobId: string } | null>(null);
  private readonly pickedTaskId = signal<string | null>(null);

  readonly job = computed(() => {
    const open = this.openJob();
    const build = open && this.builds().find((b) => b.buildId === open.buildId);
    const stage = build?.stages.find((s) => s.jobs.some((j) => j.id === open!.jobId));
    const job = stage?.jobs.find((j) => j.id === open!.jobId);
    return build && stage && job ? { build, stage, job } : null;
  });

  /** The picked step, else the first one that failed (what you usually want to debug). */
  readonly selectedTask = computed(() => {
    const tasks = this.job()?.job.tasks ?? [];
    return tasks.find((t) => t.id === this.pickedTaskId()) ?? defaultTask(tasks);
  });

  private readonly logResource = rxResource({
    params: () => {
      const key = this.detail.key();
      const open = this.openJob();
      const task = this.selectedTask();
      // State in the params: a step's log is fetched again when it finishes.
      return key && open && task?.logId ? { key, buildId: open.buildId, logId: task.logId, state: task.state } : undefined;
    },
    stream: ({ params }) => this.api.log(params.key, params.buildId, params.logId),
  });

  readonly log = computed(() => {
    const log = this.logResource.hasValue() ? this.logResource.value() : null;
    return log && log.logId === this.selectedTask()?.logId ? log : null;
  });
  readonly logLoading = this.logResource.isLoading;
  readonly logError = computed(() => (this.logResource.error() ? toApiError(this.logResource.error()) : null));

  constructor() {
    // A running step's log grows: fetch it again on each build poll.
    effect(() => {
      this.builds();
      if (untracked(() => this.selectedTask()?.state) === 'RUNNING') {
        untracked(() => this.logResource.reload());
      }
    });

    effect((onCleanup) => {
      const recentRerun = this.rerunAt() !== null && Date.now() - this.rerunAt()! < RERUN_WINDOW_MS;
      if (!anyActive(this.builds()) && !recentRerun) {
        return;
      }
      const timer = setTimeout(() => this.resource.reload(), BUILD_POLL_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  reload(): void {
    this.resource.reload();
  }

  showJob(buildId: number, jobId: string): void {
    this.pickedTaskId.set(null);
    this.openJob.set({ buildId, jobId });
  }

  closeJob(): void {
    this.openJob.set(null);
  }

  selectTask(taskId: string): void {
    this.pickedTaskId.set(taskId);
  }

  reloadLog(): void {
    this.logResource.reload();
  }

  errorFor(key: string): ApiError | null {
    const failure = this.actionError();
    return failure?.key === key ? failure.error : null;
  }

  /** Identifier of this build's stage whose rerun is in flight. */
  busyStageOf(buildId: number): string | null {
    const prefix = stageKey(buildId, '');
    const busy = this.busy();
    return busy?.startsWith(prefix) ? busy.slice(prefix.length) : null;
  }

  /** The last rerun failure, when it belongs to a stage of this build. */
  stageErrorOf(buildId: number): { stage: string; error: ApiError } | null {
    const prefix = stageKey(buildId, '');
    const failure = this.actionError();
    return failure?.key.startsWith(prefix) ? { stage: failure.key.slice(prefix.length), error: failure.error } : null;
  }

  retryStage(buildId: number, stage: string, allJobs: boolean): Promise<void> {
    return this.run(stageKey(buildId, stage), (key) => this.api.retryStage(key, buildId, stage, allJobs));
  }

  retryFailed(buildId: number): Promise<void> {
    return this.run(buildKey(buildId), (key) => this.api.retryFailed(key, buildId));
  }

  private async run(busyKey: string, call: (key: PrKey) => Observable<PrBuild[]>): Promise<void> {
    const key = this.detail.key();
    if (!key || this.busy()) {
      return;
    }
    this.busy.set(busyKey);
    this.actionError.set(null);
    try {
      this.resource.set(await firstValueFrom(call(key)));
      this.rerunAt.set(Date.now());
    } catch (err) {
      this.actionError.set({ key: busyKey, error: toApiError(err) });
    } finally {
      this.busy.set(null);
    }
  }
}
