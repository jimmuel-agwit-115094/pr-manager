/** Raw Azure DevOps Build API shapes (api-version 7.1). Only the fields we read. */

export type AdoTimelineState = 'pending' | 'inProgress' | 'completed';
export type AdoTaskResult = 'succeeded' | 'succeededWithIssues' | 'failed' | 'canceled' | 'skipped' | 'abandoned';

export interface AdoTimelineRecord {
  id: string;
  parentId: string | null;
  /** 'Stage' | 'Phase' | 'Job' | 'Task' | 'Checkpoint' | … */
  type: string;
  name: string;
  /** Stage / job ref name, e.g. "BuildSpa". */
  identifier: string | null;
  state: AdoTimelineState | null;
  result: AdoTaskResult | null;
  startTime: string | null;
  finishTime: string | null;
  order: number | null;
  attempt: number;
}

export interface AdoTimeline {
  records: AdoTimelineRecord[] | null;
}

export interface AdoBuild {
  id: number;
  status: string;
  result: string | null;
  definition?: { id: number; name: string };
  queueTime?: string;
}

/** Stage entry from ADO's run-details data provider (the API behind ADO's own build page). */
export interface AdoRunDetailsStage {
  id: string;
  refName: string | null;
  /** Ids of the stages this one waits for (same ids as the timeline's Stage records). */
  dependsOn?: string[];
}

export interface AdoRunDetails {
  stages?: AdoRunDetailsStage[];
}

export interface AdoList<T> {
  count: number;
  value: T[];
}
