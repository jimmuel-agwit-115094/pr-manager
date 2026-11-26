import { Router } from 'express';
import type { PipelineService } from '../../services/pipeline.service';
import { parsePrNumber } from '../params';

type PrParams = { owner: string; repo: string; number: string };

/** Mounted at /api/repos/:owner/:repo/pulls/:number/pipeline */
export function pipelineRoutes(pipelines: PipelineService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    res.json(await pipelines.get(owner, repo, parsePrNumber(number)));
  });

  router.post('/queue', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    res.json(await pipelines.queue(owner, repo, parsePrNumber(number)));
  });

  router.post('/requeue', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    res.json(await pipelines.requeue(owner, repo, parsePrNumber(number)));
  });

  return router;
}
