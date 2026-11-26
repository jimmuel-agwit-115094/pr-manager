# Server API and GitHub access

## Endpoints

Every route sits under `/api` and is guarded by `api/local-only.ts`. Writes need the `x-pr-manager: 1` header.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/me`, `/api/repos` | |
| GET | `/api/repos/:owner/:repo/pulls?filter=all\|mine\|review&q=` | One GraphQL `search`, cached 30s and cleared after an approve |
| GET | `…/pulls/:number` | Uncached |
| POST | `…/pulls/:number/approve` | 409 if the PR isn't open or it's your own PR. A no-op if you already approved |
| GET | `…/:number/pipeline` | |
| POST | `…/:number/pipeline/queue`, `…/pipeline/requeue` | Posts `/azp run`. 409 for the wrong action, a running pipeline, or a non-open PR |
| GET | `…/:number/builds` | `PrBuild[]`: the PR's Azure Pipelines builds with stages and jobs, from the ADO timeline. Uncached |
| POST | `…/:number/builds/:buildId/stages/:stage/retry` | `{ allJobs }` reruns one stage (failed jobs, or all jobs). Real ADO write. Returns refreshed builds |
| POST | `…/:number/builds/:buildId/retry` | Reruns the build's failed jobs. Real ADO write. Returns refreshed builds |
| GET | `…/:number/files` | `PrFiles`. The list and the PR head are fetched together and cached 30s |
| GET | `…/:number/files/view?path=` | `PrFileView`: the whole head file with the diff merged in. Cached 10 min by head sha + path (max 40) |
| GET | `…/:number/threads` | `PrReviewThread[]` |
| POST | `…/:number/threads` | `{ path, line, side, body }` posts a single comment on the head commit. Returns the refreshed threads |
| POST | `…/:number/threads/:commentId/replies` | `{ body }` replies to the thread started by that comment. Returns the refreshed threads |
| PUT | `…/:number/threads/:threadId/status` | `{ resolved }` resolves or reactivates the thread (GraphQL mutation). 404 if the thread isn't on the PR, 403 if GitHub says the viewer can't, no-op if already in that state. Returns the refreshed threads |

## GitHub clients
- **`GitHubGraphQLClient`** handles almost everything.
  - `query` throws on any GraphQL error.
  - `queryPartial` returns the data plus field-level errors. Checks use it, because check runs the token can't read come back as `null` with FORBIDDEN.
- **`GitHubRestClient`** handles what GraphQL doesn't expose or does badly:
  - file patches (`pulls/{n}/files`, pages of 100; GitHub caps the list at 3000)
  - the PR head (`pulls/{n}`: head sha and head repo, which may be a fork)
  - raw content (`contents/{path}?ref=`, raw accept header)
  - review comment writes (`POST pulls/{n}/comments` and `…/comments/{id}/replies`). These post immediately instead of adding to a pending review.
  - `post` is never retried. A 422 becomes `AppError(422)` carrying GitHub's validation message.
- Both clients share `github-http.ts`: token check, headers, one retry on 502/503/504 (GETs only), and HTTP error mapping.

## Errors
- Any layer throws `AppError(status, message, resetAt?)`. `api/error-handler.ts` returns an `ApiError` JSON body; unknown errors become a generic 500.
- GitHub responses map as follows: 401 → 401, rate limit → 429 (with `resetAt`), FORBIDDEN → 403, UNPROCESSABLE / REST 422 → 422, NOT_FOUND → 404, anything else → 502.

## Pipeline = GitHub checks (`pipeline.mapper.ts`, `PipelineService`)
- Azure Pipelines checks are CheckRuns whose `checkSuite.app.slug === 'azure-pipelines'`. Job-level checks are named `"<Pipeline> (<job>)"`; `pipelineNameOf` strips the suffix.
- `PipelineState` is `NOT_QUEUED` when there's no Azure check. Otherwise the first match wins: `RUNNING` (any check pending), then `FAILED`, `CANCELED`, `SUCCEEDED`.
- `action` is `queue` only when `NOT_QUEUED`, otherwise `requeue`. `canRun` is false while `RUNNING`.
- If check runs are FORBIDDEN, the state falls back to the rollup state and `warning` is set.
- Requeue posts `/azp run A, B` for the failed or canceled pipelines, or plain `/azp run` when none are known.

## Files (`pr-files.mapper.ts`, `PrFilesService`)
- `parsePatch` turns a patch into numbered `DiffLine`s (`context` / `add` / `del` / `hunk`). Patch lines are `commentable: true`.
- `expandToFullFile` merges those lines into the head file. The added gap lines are `commentable: false`.
- Hunks only (`isFullFile: false`) for:
  - deleted files
  - files with no patch (binary or too large)
  - a failed content fetch
- 401 and 429 still throw.

## Review threads (`review-thread.mapper.ts`, `ReviewThreadService`)
- Reads use GraphQL `reviewThreads` (up to 10 pages of 100 threads and 100 comments each). Threads with no comments are dropped.
- Each thread carries `snippet`: the last 8 lines of its first comment's `diffHunk` (parsed with `parsePatch`), and `canResolve` / `canUnresolve` from the viewer flags.
- Outdated threads keep `originalLine` as their `line`, so they still show where they were written. `line` is null only when GitHub gives neither.
- The body is trimmed, must not be empty, and is at most `MAX_COMMENT_LENGTH` characters. This is checked before calling GitHub.

## ADO builds (`build-timeline.mapper.ts`, `BuildService`)
- `AdoRestClient` (PAT basic auth, api-version 7.1). `index.ts` makes one client per org; `AdoBuildAccessor` takes that factory.
- Builds are found from the PR's Azure Pipelines check runs: `buildRefOf(detailsUrl)` parses org, project and `buildId` (dev.azure.com or *.visualstudio.com), deduped by build. When there are none (e.g. the GitHub token can't read check runs), `GET build/builds?branchName=refs/pull/{n}/merge&repositoryId={owner}/{repo}&repositoryType=GitHub` in `ADO_ORG`/`ADO_PROJECT` is used instead, keeping the latest build per pipeline definition.
- Stages come from `GET build/builds/{id}/timeline`: Stage → Phase → Job records, sorted by `order`. `succeededWithIssues` maps to `WARNING`. A stage `canRetry` when it has an `identifier` and finished FAILED, CANCELED or WARNING.
- Stage dependencies (`dependsOn`, timeline stage ids) come from ADO's **undocumented** run-details data provider: `POST {org}/_apis/Contribution/HierarchyQuery/project/{project}` (api-version `7.1-preview.1`, contribution `ms.vss-build-web.run-details-data-provider`). It's what ADO's own build page calls. Any failure is swallowed and the build gets `hasGraph: false`.
- Stage rerun: `PATCH build/builds/{id}/stages/{identifier}` `{ state: 'retry', forceRetryAllJobs, retryDependencies: true }`. Failed-job rerun: `PATCH build/builds/{id}?retry=true`.
- Only builds that reported to this PR can be rerun (404 otherwise); 409 for a non-open PR, a running stage or nothing to rerun. Returns the refreshed `PrBuild[]`.
