import type { PrPipeline } from '@pr-manager/contracts';
import type { PullRequestAccessor } from '../accessors/github/pull-request.accessor';
import { AppError } from '../errors';
import { azpRunCommand, toPrPipeline } from './mappers/pipeline.mapper';
import type { RepoService } from './repo.service';

/**
 * PR pipeline status from GitHub checks (Azure Pipelines reports there as check runs).
 * Queue / Requeue post an `/azp run` comment, which the Azure Pipelines GitHub app picks up.
 */
export class PipelineService {
  constructor(
    private readonly pullRequests: PullRequestAccessor,
    private readonly repos: RepoService,
  ) {}

  async get(owner: string, name: string, number: number): Promise<PrPipeline> {
    const repo = await this.repos.getConfigured(owner, name);
    const checks = await this.pullRequests.getChecks(repo.owner, repo.name, number);
    if (!checks) {
      throw new AppError(404, `Pull request #${number} was not found in ${repo.owner}/${repo.name}.`);
    }
    return toPrPipeline(checks);
  }

  /** First run, for a PR that has no Azure Pipelines run yet. */
  queue(owner: string, name: string, number: number): Promise<PrPipeline> {
    return this.trigger(owner, name, number, 'queue');
  }

  /** Rerun the failed (or all) pipelines of a PR that already ran. */
  requeue(owner: string, name: string, number: number): Promise<PrPipeline> {
    return this.trigger(owner, name, number, 'requeue');
  }

  private async trigger(owner: string, name: string, number: number, mode: 'queue' | 'requeue'): Promise<PrPipeline> {
    const repo = await this.repos.getConfigured(owner, name);
    const [pr, pipeline] = await Promise.all([
      this.pullRequests.get(repo.owner, repo.name, number),
      this.get(owner, name, number),
    ]);
    if (!pr) {
      throw new AppError(404, `Pull request #${number} was not found in ${repo.owner}/${repo.name}.`);
    }
    if (pr.state !== 'OPEN') {
      throw new AppError(409, 'Pipelines can only be run for open pull requests.');
    }
    if (!pipeline.canRun) {
      throw new AppError(409, 'A pipeline run is already in progress.');
    }
    if (pipeline.action !== mode) {
      throw new AppError(
        409,
        mode === 'queue' ? 'This PR has already run its pipeline. Use Requeue.' : 'This PR has not been queued yet. Use Queue.',
      );
    }

    await this.pullRequests.comment(pr.id, azpRunCommand(pipeline, mode));
    return pipeline;
  }
}
