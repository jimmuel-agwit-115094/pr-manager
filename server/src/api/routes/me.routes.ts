import { Router } from 'express';
import type { UserService } from '../../services/user.service';

export function meRoutes(users: UserService): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await users.getCurrentUser());
  });
  return router;
}
