import { Router } from 'express';
import type { RepoService } from '../../services/repo.service';

export function reposRoutes(repos: RepoService): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await repos.list());
  });
  return router;
}
