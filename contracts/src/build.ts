/**
 * State of an Azure Pipelines stage or job, from the ADO build timeline.
 * WARNING = ADO "succeeded with issues" (orange "!").
 */
export type StageState = 'NOT_STARTED' | 'RUNNING' | 'SUCCEEDED' | 'WARNING' | 'FAILED' | 'CANCELED' | 'SKIPPED';

export interface PrJob {
  id: string;
  name: string;
  state: StageState;
  /** Null until the job has both started and finished. */
  durationMs: number | null;
}

export interface PrStage {
  id: string;
  /** Stage ref name used by the ADO retry API. Null when ADO doesn't report one. */
  identifier: string | null;
  name: string;
  state: StageState;
  durationMs: number | null;
  jobs: PrJob[];
  /** Ids of the stages this one waits for. Empty for the first stages, or when dependencies are unknown. */
  dependsOn: string[];
  /** True when the stage finished failed, canceled or with issues, so "Rerun just this stage" applies. */
  canRetry: boolean;
}

/** One Azure Pipelines build that reported to the PR, with its stages. */
export interface PrBuild {
  buildId: number;
  pipeline: string;
  /** Build results page in Azure DevOps. */
  url: string;
  state: StageState;
  stages: PrStage[];
  /** False when stage dependencies couldn't be read; the stages then show as one row with no lines. */
  hasGraph: boolean;
  /** True when the build finished and has failed or canceled jobs to rerun. */
  canRetryFailed: boolean;
}

/** Body of POST …/builds/:buildId/stages/:stage/retry. */
export interface RetryStageRequest {
  /** false = rerun only the failed jobs of the stage, true = rerun all its jobs. */
  allJobs: boolean;
}
