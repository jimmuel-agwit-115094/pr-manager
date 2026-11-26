import type { CiState, PipelineState, PrCheck, PrPipeline } from '@pr-manager/contracts';
import type {
  GitHubCheckContext,
  GitHubCheckRunNode,
  GitHubPullRequestChecks,
  GitHubStatusContextNode,
} from '../../accessors/github/github.types';

export const AZURE_PIPELINES_APP = 'azure-pipelines';
export const CHECKS_FORBIDDEN_WARNING =
  "Your GitHub token can't read check runs, so only GitHub's overall status is shown. Give the token read access to Checks.";

const MAX_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 400;

const STATE_ORDER: Record<CiState, number> = { FAILURE: 0, PENDING: 1, SUCCESS: 2, NONE: 3 };

/** "Passport PR (Build API)" → "Passport PR". Azure Pipelines names job-level checks after their pipeline. */
export function pipelineNameOf(checkName: string): string {
  return checkName.replace(/\s*\(.*\)\s*$/, '').trim() || checkName;
}

function cleanMessages(lines: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    for (const line of (raw ?? '').split(/\r?\n/)) {
      const text = line
        .replace(/<[^>]+>/g, '')
        .replace(/[*_`#>]/g, '')
        .trim()
        .slice(0, MAX_MESSAGE_LENGTH);
      if (text && !seen.has(text)) {
        seen.add(text);
        out.push(text);
      }
    }
  }
  return out.slice(0, MAX_MESSAGES);
}

function fromCheckRun(run: GitHubCheckRunNode): PrCheck {
  const base = {
    name: run.name,
    source: run.checkSuite?.app?.name ?? 'GitHub check',
    isAzurePipeline: run.checkSuite?.app?.slug === AZURE_PIPELINES_APP,
    url: run.detailsUrl,
  };

  if (run.status !== 'COMPLETED') {
    const label = run.status === 'IN_PROGRESS' ? 'In progress' : run.status === 'WAITING' ? 'Waiting' : 'Queued';
    return { ...base, state: 'PENDING', label, messages: [] };
  }

  switch (run.conclusion) {
    case 'SUCCESS':
      return { ...base, state: 'SUCCESS', label: 'Succeeded', messages: [] };
    case 'FAILURE':
    case 'TIMED_OUT':
    case 'STARTUP_FAILURE':
    case 'ACTION_REQUIRED': {
      const label = { FAILURE: 'Failed', TIMED_OUT: 'Timed out', STARTUP_FAILURE: 'Failed to start', ACTION_REQUIRED: 'Action required' }[
        run.conclusion
      ];
      const annotations = (run.annotations?.nodes ?? []).filter((a) => a.annotationLevel === 'FAILURE').map((a) => a.message);
      return { ...base, state: 'FAILURE', label, messages: cleanMessages([run.title, ...annotations, run.summary]) };
    }
    case 'CANCELLED':
      return { ...base, state: 'NONE', label: 'Canceled', messages: [] };
    default:
      return { ...base, state: 'NONE', label: run.conclusion === 'SKIPPED' ? 'Skipped' : 'Neutral', messages: [] };
  }
}

function fromStatusContext(status: GitHubStatusContextNode): PrCheck {
  const base = { name: status.context, source: status.context, isAzurePipeline: false, url: status.targetUrl };
  switch (status.state) {
    case 'SUCCESS':
      return { ...base, state: 'SUCCESS', label: 'Succeeded', messages: [] };
    case 'FAILURE':
    case 'ERROR':
      return { ...base, state: 'FAILURE', label: 'Failed', messages: cleanMessages([status.description]) };
    default:
      return { ...base, state: 'PENDING', label: 'Pending', messages: [] };
  }
}

export function toPrCheck(context: NonNullable<GitHubCheckContext>): PrCheck {
  return context.__typename === 'CheckRun' ? fromCheckRun(context) : fromStatusContext(context);
}

function stateFromAzureChecks(checks: PrCheck[]): PipelineState {
  if (checks.some((c) => c.state === 'PENDING')) {
    return 'RUNNING';
  }
  if (checks.some((c) => c.state === 'FAILURE')) {
    return 'FAILED';
  }
  if (checks.some((c) => c.label === 'Canceled')) {
    return 'CANCELED';
  }
  return 'SUCCEEDED';
}

function stateFromRollup(rollup: GitHubPullRequestChecks['rollupState']): PipelineState {
  switch (rollup) {
    case null:
      return 'NOT_QUEUED';
    case 'SUCCESS':
      return 'SUCCEEDED';
    case 'FAILURE':
    case 'ERROR':
      return 'FAILED';
    default:
      return 'RUNNING';
  }
}

export function toPrPipeline(raw: GitHubPullRequestChecks): PrPipeline {
  const checks = raw.contexts
    .filter((c): c is NonNullable<GitHubCheckContext> => c !== null)
    .map(toPrCheck)
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name));

  const azure = checks.filter((c) => c.isAzurePipeline);
  const pipelines = [...new Set(azure.map((c) => pipelineNameOf(c.name)))];

  let state: PipelineState;
  let warning: string | null = null;
  if (azure.length) {
    state = stateFromAzureChecks(azure);
  } else if (raw.forbidden) {
    // Azure Pipelines check runs are hidden from this token; fall back to GitHub's overall rollup.
    state = stateFromRollup(raw.rollupState);
    warning = CHECKS_FORBIDDEN_WARNING;
  } else {
    state = 'NOT_QUEUED';
  }

  return {
    state,
    pipelines,
    checks,
    action: state === 'NOT_QUEUED' ? 'queue' : 'requeue',
    canRun: state !== 'RUNNING',
    warning,
  };
}

/**
 * Azure Pipelines comment trigger. Requeue targets the failed/canceled pipelines when known,
 * otherwise every PR pipeline (`/azp run`).
 */
export function azpRunCommand(pipeline: PrPipeline, mode: 'queue' | 'requeue'): string {
  if (mode === 'queue') {
    return '/azp run';
  }
  const failed = [
    ...new Set(
      pipeline.checks
        .filter((c) => c.isAzurePipeline && (c.state === 'FAILURE' || c.label === 'Canceled'))
        .map((c) => pipelineNameOf(c.name)),
    ),
  ];
  return failed.length ? `/azp run ${failed.join(', ')}` : '/azp run';
}
