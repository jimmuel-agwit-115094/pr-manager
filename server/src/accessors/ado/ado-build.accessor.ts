import type { AdoRestClient } from './ado-rest.client';
import type { AdoBuild, AdoList, AdoLogLines, AdoRunDetails, AdoTimeline } from './ado.types';

const RUN_DETAILS_PROVIDER = 'ms.vss-build-web.run-details-data-provider';

/** Azure DevOps Build REST calls. Raw shapes, no business rules. One client per organization. */
export class AdoBuildAccessor {
  constructor(private readonly clientFor: (org: string) => AdoRestClient) {}

  /** Recent builds of a GitHub PR's merge ref, newest first. */
  async listPullRequestBuilds(org: string, project: string, githubRepo: string, number: number): Promise<AdoBuild[]> {
    const list = await this.clientFor(org).get<AdoList<AdoBuild>>(project, 'build/builds', {
      branchName: `refs/pull/${number}/merge`,
      repositoryId: githubRepo,
      repositoryType: 'GitHub',
      queryOrder: 'queueTimeDescending',
      $top: 50,
    });
    return list.value ?? [];
  }

  getTimeline(org: string, project: string, buildId: number): Promise<AdoTimeline> {
    return this.clientFor(org).get<AdoTimeline>(project, `build/builds/${buildId}/timeline`);
  }

  getLog(org: string, project: string, buildId: number, logId: number): Promise<AdoLogLines> {
    return this.clientFor(org).get<AdoLogLines>(project, `build/builds/${buildId}/logs/${logId}`);
  }

  /**
   * Stage dependencies, which the public timeline API doesn't expose. Uses ADO's run-details data
   * provider (undocumented; what ADO's build page calls), so callers must tolerate it failing.
   */
  async getRunDetails(org: string, project: string, buildId: number): Promise<AdoRunDetails | null> {
    const response = await this.clientFor(org).orgPost<{ dataProviders?: Record<string, AdoRunDetails | undefined> }>(
      `Contribution/HierarchyQuery/project/${encodeURIComponent(project)}`,
      {
        contributionIds: [RUN_DETAILS_PROVIDER],
        dataProviderContext: {
          properties: {
            buildId: String(buildId),
            sourcePage: { routeId: 'ms.vss-build-web.ci-results-hub-route', routeValues: { project } },
          },
        },
      },
      '7.1-preview.1',
    );
    return response.dataProviders?.[RUN_DETAILS_PROVIDER] ?? null;
  }

  /** ADO's "Rerun just this stage". forceRetryAllJobs=false reruns only the failed jobs. */
  retryStage(org: string, project: string, buildId: number, stage: string, forceRetryAllJobs: boolean): Promise<unknown> {
    return this.clientFor(org).patch<unknown>(project, `build/builds/${buildId}/stages/${encodeURIComponent(stage)}`, {
      state: 'retry',
      forceRetryAllJobs,
      retryDependencies: true,
    });
  }

  /** ADO's "Rerun failed jobs" for the whole build. */
  retryBuild(org: string, project: string, buildId: number): Promise<AdoBuild> {
    return this.clientFor(org).patch<AdoBuild>(project, `build/builds/${buildId}`, {}, { retry: 'true' });
  }
}
