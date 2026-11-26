import type { PrJob, PrStage, StageState } from '@pr-manager/contracts';
import type { AdoRunDetails, AdoTimelineRecord } from '../../accessors/ado/ado.types';

/** Where an Azure Pipelines check's details URL points: one ADO build. */
export interface BuildRef {
  org: string;
  project: string;
  buildId: number;
}

/**
 * Parses an ADO build results URL:
 * `https://dev.azure.com/{org}/{project}/_build/results?buildId=N` or
 * `https://{org}.visualstudio.com/{project}/_build/results?buildId=N`.
 */
export function buildRefOf(url: string | null): BuildRef | null {
  if (!url) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const buildId = Number(parsed.searchParams.get('buildId'));
  if (!Number.isSafeInteger(buildId) || buildId <= 0) {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const host = parsed.hostname.toLowerCase();
  if (host === 'dev.azure.com' && segments.length >= 2) {
    return { org: segments[0]!, project: segments[1]!, buildId };
  }
  if (host.endsWith('.visualstudio.com') && segments.length >= 1) {
    return { org: host.slice(0, -'.visualstudio.com'.length), project: segments[0]!, buildId };
  }
  return null;
}

export function buildUrlOf(ref: BuildRef): string {
  return `https://dev.azure.com/${encodeURIComponent(ref.org)}/${encodeURIComponent(ref.project)}/_build/results?buildId=${ref.buildId}`;
}

function stateOf(record: AdoTimelineRecord): StageState {
  if (record.state === 'inProgress') {
    return 'RUNNING';
  }
  if (record.state !== 'completed') {
    return 'NOT_STARTED';
  }
  switch (record.result) {
    case 'succeeded':
      return 'SUCCEEDED';
    case 'succeededWithIssues':
      return 'WARNING';
    case 'failed':
      return 'FAILED';
    case 'canceled':
    case 'abandoned':
      return 'CANCELED';
    default:
      return 'SKIPPED';
  }
}

function durationOf(record: AdoTimelineRecord): number | null {
  if (!record.startTime || !record.finishTime) {
    return null;
  }
  const ms = Date.parse(record.finishTime) - Date.parse(record.startTime);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

const byOrder = (a: AdoTimelineRecord, b: AdoTimelineRecord): number => (a.order ?? 0) - (b.order ?? 0);

const RETRYABLE: ReadonlySet<StageState> = new Set(['FAILED', 'CANCELED', 'WARNING']);

/** Run-details stages → stage id → ids it depends on. Null when ADO gave nothing usable. */
export function dependenciesOf(details: AdoRunDetails | null): Map<string, string[]> | null {
  if (!details?.stages?.length) {
    return null;
  }
  return new Map(details.stages.map((s) => [s.id, s.dependsOn ?? []]));
}

/**
 * Timeline → stages in run order, each with its jobs (stage → phase → job in ADO).
 * `dependencies` (from run details) adds each stage's `dependsOn`, keeping only ids of stages that exist.
 */
export function toPrStages(records: readonly AdoTimelineRecord[], dependencies: Map<string, string[]> | null = null): PrStage[] {
  const stageIds = new Set(records.filter((r) => r.type === 'Stage').map((r) => r.id));
  const childrenOf = new Map<string, AdoTimelineRecord[]>();
  for (const record of records) {
    if (record.parentId) {
      childrenOf.set(record.parentId, [...(childrenOf.get(record.parentId) ?? []), record]);
    }
  }

  return records
    .filter((r) => r.type === 'Stage')
    .sort(byOrder)
    .map((stage) => {
      const phases = (childrenOf.get(stage.id) ?? []).filter((r) => r.type === 'Phase').sort(byOrder);
      const jobs: PrJob[] = phases.flatMap((phase) =>
        (childrenOf.get(phase.id) ?? [])
          .filter((r) => r.type === 'Job')
          .sort(byOrder)
          .map((job) => ({ id: job.id, name: job.name, state: stateOf(job), durationMs: durationOf(job) })),
      );
      const state = stateOf(stage);
      return {
        id: stage.id,
        identifier: stage.identifier,
        name: stage.name,
        state,
        durationMs: durationOf(stage),
        jobs,
        dependsOn: (dependencies?.get(stage.id) ?? []).filter((id) => id !== stage.id && stageIds.has(id)),
        canRetry: !!stage.identifier && RETRYABLE.has(state),
      };
    });
}

/** Whole-build state: running wins, then failed, canceled, warning, succeeded. */
export function buildStateOf(stages: readonly PrStage[]): StageState {
  const states = new Set(stages.map((s) => s.state));
  for (const state of ['RUNNING', 'FAILED', 'CANCELED', 'WARNING'] as const) {
    if (states.has(state)) {
      return state;
    }
  }
  if (states.has('NOT_STARTED')) {
    return states.has('SUCCEEDED') || states.has('WARNING') ? 'RUNNING' : 'NOT_STARTED';
  }
  return stages.length ? 'SUCCEEDED' : 'NOT_STARTED';
}
