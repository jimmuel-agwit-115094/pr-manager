import type { CiState } from './pull-request';

/** One GitHub check on the PR head commit: a check run (e.g. Azure Pipelines) or a commit status (e.g. Checkmarx). */
export interface PrCheck {
  name: string;
  /** App or context that reported it, e.g. "Azure Pipelines", "Checkmarx". */
  source: string;
  state: CiState;
  /** Human status, e.g. "Queued", "In progress", "Failed", "Succeeded". */
  label: string;
  isAzurePipeline: boolean;
  url: string | null;
  /** Error details for failed checks (title, summary, failure annotations). */
  messages: string[];
}

/**
 * Overall state of the PR's Azure Pipelines run(s):
 * NOT_QUEUED (no Azure Pipelines check yet), RUNNING, SUCCEEDED, FAILED, CANCELED.
 */
export type PipelineState = 'NOT_QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface PrPipeline {
  state: PipelineState;
  /** Azure pipeline names seen in the checks, e.g. ["Passport PR"]. */
  pipelines: string[];
  checks: PrCheck[];
  /** Which button to show: Queue when nothing has run yet, otherwise Requeue. */
  action: 'queue' | 'requeue';
  /** False while a run is in progress. */
  canRun: boolean;
  /** Set when the token can't read individual check runs; state then comes from GitHub's rollup only. */
  warning: string | null;
}
