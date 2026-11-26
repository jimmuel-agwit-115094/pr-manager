import type { PrBuild, PrPipeline } from '@pr-manager/contracts';
import type { AdoBuildAccessor } from '../accessors/ado/ado-build.accessor';
import type { PullRequestAccessor } from '../accessors/github/pull-request.accessor';
import { AppError } from '../errors';
import { buildRefOf, buildStateOf, buildUrlOf, dependenciesOf, toPrStages, type BuildRef } from './mappers/build-timeline.mapper';
import { pipelineNameOf } from './mappers/pipeline.mapper';
import type { PipelineService } from './pipeline.service';
import type { RepoService } from './repo.service';

interface PrBuildRef extends BuildRef {
  pipeline: string;
}

/**
 * Azure Pipelines stages for a PR, read from the ADO build timeline, and stage / failed-job reruns.
 * Builds come from the PR's GitHub check runs (their details URL carries the ADO build id). When the
 * GitHub token can't read check runs, they come from ADO instead: the latest build per pipeline of
 * the PR's merge ref (`refs/pull/{n}/merge`) in the default org/project.
 * Only builds found for this PR can be rerun. Reruns are real ADO writes and never retried.
 */
export class BuildService {
  constructor(
    private readonly ado: AdoBuildAccessor,
    private readonly pipelines: PipelineService,
    private readonly pullRequests: PullRequestAccessor,
    private readonly repos: RepoService,
    private readonly defaultOrg: string,
    private readonly defaultProject: string,
  ) {}

  async list(owner: string, name: string, number: number): Promise<PrBuild[]> {
    const refs = await this.findRefs(owner, name, number);
    return Promise.all(refs.map((ref) => this.load(ref)));
  }

  async retryStage(owner: string, name: string, number: number, buildId: number, stage: string, allJobs: boolean): Promise<PrBuild[]> {
    const { ref, build } = await this.findOpenBuild(owner, name, number, buildId);
    const target = build.stages.find((s) => s.identifier === stage);
    if (!target) {
      throw new AppError(404, `Stage "${stage}" was not found in build ${buildId}.`);
    }
    if (target.state === 'RUNNING') {
      throw new AppError(409, `Stage "${target.name}" is still running.`);
    }
    if (!allJobs && !target.canRetry) {
      throw new AppError(409, `Stage "${target.name}" has no failed jobs to rerun.`);
    }
    await this.ado.retryStage(ref.org, ref.project, buildId, stage, allJobs);
    return this.list(owner, name, number);
  }

  async retryFailed(owner: string, name: string, number: number, buildId: number): Promise<PrBuild[]> {
    const { ref, build } = await this.findOpenBuild(owner, name, number, buildId);
    if (!build.canRetryFailed) {
      throw new AppError(409, build.state === 'RUNNING' ? 'The build is still running.' : 'The build has no failed jobs to rerun.');
    }
    await this.ado.retryBuild(ref.org, ref.project, buildId);
    return this.list(owner, name, number);
  }

  private async findRefs(owner: string, name: string, number: number): Promise<PrBuildRef[]> {
    const fromChecks = buildRefsOf(await this.pipelines.get(owner, name, number));
    if (fromChecks.length) {
      return fromChecks;
    }
    const repo = await this.repos.getConfigured(owner, name);
    const builds = await this.ado.listPullRequestBuilds(this.defaultOrg, this.defaultProject, `${repo.owner}/${repo.name}`, number);
    // Newest first, so the first build seen per pipeline is its latest run.
    const latest = new Map<number, PrBuildRef>();
    for (const build of builds) {
      const definitionId = build.definition?.id ?? -build.id;
      if (!latest.has(definitionId)) {
        latest.set(definitionId, {
          org: this.defaultOrg,
          project: this.defaultProject,
          buildId: build.id,
          pipeline: build.definition?.name ?? `Build ${build.id}`,
        });
      }
    }
    return [...latest.values()];
  }

  private async findOpenBuild(owner: string, name: string, number: number, buildId: number): Promise<{ ref: PrBuildRef; build: PrBuild }> {
    const repo = await this.repos.getConfigured(owner, name);
    const [pr, refs] = await Promise.all([this.pullRequests.get(repo.owner, repo.name, number), this.findRefs(owner, name, number)]);
    if (!pr) {
      throw new AppError(404, `Pull request #${number} was not found in ${repo.owner}/${repo.name}.`);
    }
    if (pr.state !== 'OPEN') {
      throw new AppError(409, 'Pipelines can only be rerun for open pull requests.');
    }
    const ref = refs.find((r) => r.buildId === buildId);
    if (!ref) {
      throw new AppError(404, `Build ${buildId} did not run for this pull request.`);
    }
    return { ref, build: await this.load(ref) };
  }

  private async load(ref: PrBuildRef): Promise<PrBuild> {
    const [timeline, details] = await Promise.all([
      this.ado.getTimeline(ref.org, ref.project, ref.buildId),
      // Undocumented API: without it the stages still show, just without the graph.
      this.ado.getRunDetails(ref.org, ref.project, ref.buildId).catch(() => null),
    ]);
    const dependencies = dependenciesOf(details);
    const stages = toPrStages(timeline.records ?? [], dependencies);
    const state = buildStateOf(stages);
    return {
      buildId: ref.buildId,
      pipeline: ref.pipeline,
      url: buildUrlOf(ref),
      state,
      stages,
      hasGraph: dependencies !== null,
      canRetryFailed: state !== 'RUNNING' && state !== 'NOT_STARTED' && stages.some((s) => s.state === 'FAILED' || s.state === 'CANCELED'),
    };
  }
}

/** One entry per ADO build behind the PR's Azure Pipelines checks (job-level checks share a build). */
function buildRefsOf(pipeline: PrPipeline): PrBuildRef[] {
  const refs = new Map<number, PrBuildRef>();
  for (const check of pipeline.checks) {
    const ref = check.isAzurePipeline ? buildRefOf(check.url) : null;
    if (ref && !refs.has(ref.buildId)) {
      refs.set(ref.buildId, { ...ref, pipeline: pipelineNameOf(check.name) });
    }
  }
  return [...refs.values()];
}
