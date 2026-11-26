import { AdoBuildAccessor } from './accessors/ado/ado-build.accessor';
import { AdoRestClient } from './accessors/ado/ado-rest.client';
import { RepoConfigAccessor } from './accessors/config/repo-config.accessor';
import { GitHubGraphQLClient } from './accessors/github/github-graphql.client';
import { GitHubRestClient } from './accessors/github/github-rest.client';
import { PullRequestFilesAccessor } from './accessors/github/pull-request-files.accessor';
import { ReviewThreadAccessor } from './accessors/github/review-thread.accessor';
import { PullRequestAccessor } from './accessors/github/pull-request.accessor';
import { ViewerAccessor } from './accessors/github/viewer.accessor';
import { createApp } from './api/app';
import { env } from './config/env';
import { BuildService } from './services/build.service';
import { PipelineService } from './services/pipeline.service';
import { PrFilesService } from './services/pr-files.service';
import { PullRequestService } from './services/pull-request.service';
import { RepoService } from './services/repo.service';
import { ReviewThreadService } from './services/review-thread.service';
import { UserService } from './services/user.service';

// Composition root: wire accessors → services → api.
const github = new GitHubGraphQLClient(env.githubToken);

const users = new UserService(new ViewerAccessor(github));
const repos = new RepoService(new RepoConfigAccessor(env.reposConfigPath));
const prAccessor = new PullRequestAccessor(github);
const pullRequests = new PullRequestService(prAccessor, repos, users);
const pipelines = new PipelineService(prAccessor, repos);
const githubRest = new GitHubRestClient(env.githubToken);
const filesAccessor = new PullRequestFilesAccessor(githubRest);
const files = new PrFilesService(filesAccessor, repos);
const threads = new ReviewThreadService(new ReviewThreadAccessor(github, githubRest), filesAccessor, repos);
// Builds live in whichever ADO org their check URL names: one client per org, same PAT.
const adoClients = new Map<string, AdoRestClient>();
const adoClientFor = (org: string): AdoRestClient => {
  const key = org.toLowerCase();
  let client = adoClients.get(key);
  if (!client) {
    client = new AdoRestClient(org, env.adoPat);
    adoClients.set(key, client);
  }
  return client;
};
const builds = new BuildService(new AdoBuildAccessor(adoClientFor), pipelines, prAccessor, repos, env.adoOrg, env.adoProject);

createApp({ users, repos, pullRequests, pipelines, builds, files, threads }).listen(env.port, '127.0.0.1', () => {
  console.log(`pr-manager server on http://localhost:${env.port}`);
  if (!env.githubToken) {
    console.warn('GITHUB_TOKEN is not set. Copy .env.example to .env and add it.');
  }
});
