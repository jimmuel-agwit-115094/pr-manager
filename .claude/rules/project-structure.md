# Project structure

```
contracts/src/        shared DTO types, imports nothing
server/src/
  index.ts            composition root: manual constructor DI
  config/env.ts       .env loading
  errors.ts           AppError(status, message, resetAt?)
  api/                Express app, routes, local-only guard, error handler
  services/           business rules; mappers/ turn GitHub shapes into contracts
  accessors/github/   GraphQL + REST clients, raw GitHub types, queries
  accessors/ado/      ADO REST client + build accessor (timeline, stage / failed-job retry)
web/src/app/
  data-access/        thin HttpClient wrappers, no state
  services/           signal stores + pure helpers
  ui/pages/           routed pages and tabs
  ui/components/      reusable presentational components
  ui/shared/          SCSS partials (_buttons.scss)
  ui/pipes/           time-ago
```

## contracts/
- Shared DTOs: `PullRequestSummary` / `PullRequestDetail`, `PrPipeline` / `PrCheck`, `PrFiles` / `PrFileChange` / `DiffLine` / `PrFileView`, `PrReviewThread` / `PrReviewComment` / `NewReviewComment`, `PrBuild` / `PrStage` / `PrJob`, `Repo`, `PrFilter`, `ApiError`.
- The package is `"type": "module"` and both apps consume it as raw TS source (`exports: ./src/index.ts`). The server `tsconfig` includes `../contracts/src`; the web app maps it through `paths`.

## server/ (Express 5, ESM)
- Layers: `api → services → accessors → GitHub`.
- `createApp(services)` in `api/app.ts` takes services only; `index.ts` builds them.
- Accessors return raw GitHub shapes (`accessors/github/github.types.ts`). Services map them to contracts in `services/mappers/`.

| Service | Accessors |
|---------|-----------|
| `UserService` | `ViewerAccessor` |
| `RepoService` | `RepoConfigAccessor` (`repos.config.json`) |
| `PullRequestService` | `PullRequestAccessor` (search / get / approve / comment / checks) |
| `PipelineService` | `PullRequestAccessor` |
| `PrFilesService` | `PullRequestFilesAccessor` (file list, PR head, raw content) |
| `ReviewThreadService` | `ReviewThreadAccessor` (GraphQL reads, REST writes) + `PullRequestFilesAccessor` (head sha) |
| `BuildService` | `AdoBuildAccessor` (timeline, retries) + `PipelineService` (check URLs → build ids) + `PullRequestAccessor` (PR state) |

## web/ (Angular 22, standalone, signals, zoneless, `withComponentInputBinding`)
- Layers: `ui → services (stores) → data-access → /api`.
- `data-access/`:
  - `PullRequestApi`, `PipelineApi`, `BuildApi`, `ReviewApi`, `RepoApi`, `UserApi`
  - `csrfInterceptor` adds `x-pr-manager: 1` to non-GET `/api` calls
  - `toApiError` normalises HTTP failures
- `services/`:
  - `PrListStore` (root): repo, filter and search signals (search debounced 300ms), plus an `rxResource` for the PRs.
  - `UserPrefsService`: remembers the last repo and filter in localStorage, with every access wrapped in try/catch.
  - `CurrentUserStore` (root): the signed-in user.
  - `PrDetailStore` (provided by `PrDetailPage`; its tabs inject it):
    - loads the detail and the pipeline
    - actions `approve` / `queue` / `requeue` run one at a time (`busy`) and keep failures in `actionError`
    - pure helpers `pipelineStatusLine` / `approvalStatusLine` / `conflictStatusLine`
    - Files Changed state: `loadFiles()` (lazy), `fileTree`, `orderedFiles`, `selectFile()`, `selectedFile`, `fileView`
  - `file-view-rows.ts`: pure `buildLineRows` (threads under their line, outdated ones at the nearest line) and `collapseUnchanged` (gap rows).
  - `BuildStore` (provided by `PrPipelineTab`): the PR's builds and stages, `retryStage` / `retryFailed` (one at a time, errors keyed per build or stage), polling while running. Pure `formatDuration`.
  - `stage-graph.ts`: pure `layoutColumns`, `edgesOf`, `edgePath`, `expandedByDefault`.
  - `file-tree.ts`: pure tree building (folders first, single-folder chains joined) and the matching file order.
  - `ReviewThreadsStore` (provided by `PrFilesTab` and `PrOverviewTab`, so it reloads each time either opens):
    - threads grouped by file and line (`groupThreads`, `lineKey`, `anchorOf`, `lineKeysOf`)
    - the `draft` / `replyingTo` / `posting` / `postError` / `lastAction` state, and the `comment` / `reply` / `setResolved` actions
    - Overview helpers: `commentStatusLine`, `filterThreads`, `filter` / `filtered` / `counts`, `statusKey`, `statusErrorFor`
- `ui/pages`:
  - `pr-list`
  - `pr-detail`, with `tabs/overview`, `tabs/files`, `tabs/pipeline` and `tabs/coming-soon`
- `ui/components`:
  - `status-row`, `ci-status-dot`, `pr-list-item`, `repo-picker`, `pr-filter-tabs`
  - `comment-box` (plus the pure `markdown-format.ts`)
  - `review-thread`, `code-snippet` (file header plus a few diff lines)
  - `stage-graph` (columns by dependency depth, SVG connectors measured after render), `stage-card` (expandable: jobs, rerun split button), `stage-list` (All Stages), `stage-state-icon`
