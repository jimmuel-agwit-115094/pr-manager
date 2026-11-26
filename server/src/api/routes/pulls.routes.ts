import { Router } from 'express';
import { isPrFilter } from '@pr-manager/contracts';
import { AppError } from '../../errors';
import type { PullRequestService } from '../../services/pull-request.service';
import { parsePrNumber } from '../params';

type RepoParams = { owner: string; repo: string };

export function pullsRoutes(pullRequests: PullRequestService): Router {
  const router = Router({ mergeParams: true });

  // GET /api/repos/:owner/:repo/pulls?filter=all|mine|review&q=
  router.get('/', async (req, res) => {
    const { owner, repo } = req.params as RepoParams;
    const filter = req.query['filter'] ?? 'all';
    const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';

    if (!isPrFilter(filter)) {
      throw new AppError(400, `Invalid filter "${String(filter)}". Use all, mine or review.`);
    }
    res.json(await pullRequests.list(owner, repo, filter, q));
  });

  // GET /api/repos/:owner/:repo/pulls/:number
  router.get('/:number', async (req, res) => {
    const { owner, repo, number } = req.params as RepoParams & { number: string };
    res.json(await pullRequests.get(owner, repo, parsePrNumber(number)));
  });

  // POST /api/repos/:owner/:repo/pulls/:number/approve
  router.post('/:number/approve', async (req, res) => {
    const { owner, repo, number } = req.params as RepoParams & { number: string };
    res.json(await pullRequests.approve(owner, repo, parsePrNumber(number)));
  });

  return router;
}
