import { Router } from 'express';
import { AppError } from '../../errors';
import type { PrFilesService } from '../../services/pr-files.service';
import { parsePrNumber } from '../params';

type PrParams = { owner: string; repo: string; number: string };

/** Mounted at /api/repos/:owner/:repo/pulls/:number/files */
export function filesRoutes(files: PrFilesService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    res.json(await files.get(owner, repo, parsePrNumber(number)));
  });

  // GET …/files/view?path=src/a.ts
  router.get('/view', async (req, res) => {
    const { owner, repo, number } = req.params as PrParams;
    const path = req.query['path'];
    if (typeof path !== 'string' || !path) {
      throw new AppError(400, 'Missing "path" query parameter.');
    }
    res.json(await files.getView(owner, repo, parsePrNumber(number), path));
  });

  return router;
}
