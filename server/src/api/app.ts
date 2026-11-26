import express, { type Express } from 'express';
import type { BuildService } from '../services/build.service';
import type { PipelineService } from '../services/pipeline.service';
import type { PrFilesService } from '../services/pr-files.service';
import type { ReviewThreadService } from '../services/review-thread.service';
import type { PullRequestService } from '../services/pull-request.service';
import type { RepoService } from '../services/repo.service';
import type { UserService } from '../services/user.service';
import { errorHandler } from './error-handler';
import { localOnly } from './local-only';
import { buildsRoutes } from './routes/builds.routes';
import { filesRoutes } from './routes/files.routes';
import { meRoutes } from './routes/me.routes';
import { pipelineRoutes } from './routes/pipeline.routes';
import { pullsRoutes } from './routes/pulls.routes';
import { reposRoutes } from './routes/repos.routes';
import { threadsRoutes } from './routes/threads.routes';

export interface AppServices {
  users: UserService;
  repos: RepoService;
  pullRequests: PullRequestService;
  pipelines: PipelineService;
  builds: BuildService;
  files: PrFilesService;
  threads: ReviewThreadService;
}

/** HTTP layer only. Depends on services, never on accessors. */
export function createApp(services: AppServices): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', localOnly);

  app.use('/api/me', meRoutes(services.users));
  app.use('/api/repos/:owner/:repo/pulls/:number/pipeline', pipelineRoutes(services.pipelines));
  app.use('/api/repos/:owner/:repo/pulls/:number/builds', buildsRoutes(services.builds));
  app.use('/api/repos/:owner/:repo/pulls/:number/files', filesRoutes(services.files));
  app.use('/api/repos/:owner/:repo/pulls/:number/threads', threadsRoutes(services.threads));
  app.use('/api/repos/:owner/:repo/pulls', pullsRoutes(services.pullRequests));
  app.use('/api/repos', reposRoutes(services.repos));

  app.use('/api', (_req, res) => {
    res.status(404).json({ status: 404, message: 'Not found.' });
  });
  app.use(errorHandler);
  return app;
}
