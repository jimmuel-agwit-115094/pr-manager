import express, { Router } from 'express';
import { AppError } from '../../errors';
import type { BuildService } from '../../services/build.service';
import { parsePrNumber } from '../params';

type PrParams = { owner: string; repo: string; number: string };
type BuildParams = PrParams & { buildId: string };

/** ADO stage ref names: letters, digits and underscores. */
const STAGE = /^[A-Za-z0-9_]{1,256}$/;

/** Mounted at /api/repos/:owner/:repo/pulls/:number/builds */
export function buildsRoutes(builds: BuildService): Router {
  const router = Router({ mergeParams: true });
  router.use(express.json({ limit: '16kb' }));

  router.get('/', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    res.json(await builds.list(owner, repo, parsePrNumber(number)));
  });

  // GET /:buildId/logs/:logId → one step's log lines
  router.get('/:buildId/logs/:logId', async (req, res) => {
    const { owner, repo, number, buildId, logId } = req.params as BuildParams & { logId: string };
    const id = Number(logId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError(400, `Invalid log id "${logId}".`);
    }
    res.json(await builds.getLog(owner, repo, parsePrNumber(number), parseBuildId(buildId), id));
  });

  // POST /:buildId/retry → reruns the failed jobs of the whole build
  router.post('/:buildId/retry', async (req, res) => {
    const { owner, repo, number, buildId } = req.params as BuildParams;
    res.json(await builds.retryFailed(owner, repo, parsePrNumber(number), parseBuildId(buildId)));
  });

  // POST /:buildId/stages/:stage/retry { allJobs } → reruns one stage (failed jobs, or all jobs)
  router.post('/:buildId/stages/:stage/retry', async (req, res) => {
    const { owner, repo, number, buildId, stage } = req.params as BuildParams & { stage: string };
    if (!STAGE.test(stage)) {
      throw new AppError(400, `Invalid stage "${stage}".`);
    }
    const allJobs = (req.body as { allJobs?: unknown } | undefined)?.allJobs;
    if (typeof allJobs !== 'boolean') {
      throw new AppError(400, 'allJobs must be true or false.');
    }
    res.json(await builds.retryStage(owner, repo, parsePrNumber(number), parseBuildId(buildId), stage, allJobs));
  });

  return router;
}

function parseBuildId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError(400, `Invalid build id "${value}".`);
  }
  return id;
}
