# Constraints

## Layering
- Server: `api → services → accessors → GitHub`.
  - Routes never touch accessors.
  - Accessors return raw GitHub shapes, with no business rules.
  - Services map them to contracts in `services/mappers/`.
- Web: `ui → services (stores) → data-access → /api`.
  - UI components never inject `HttpClient` or any `*.api.ts`. Pages and tabs bind to stores.
  - Reusable components take inputs and emit outputs.
- `contracts/` imports nothing. Keep it to types and plain constants.
- Wire new services in `server/src/index.ts`, the only place that constructs anything.

## Security
- Tokens stay server-side. The browser only ever talks to `/api`.
- `api/local-only.ts` guards all of `/api`:
  - the Host header must be localhost, which blocks DNS rebinding
  - non-GET requests need `x-pr-manager: 1`, which blocks cross-site POSTs
- Keep that guard on every new write endpoint. The web `csrfInterceptor` adds the header.
- Validate request bodies in the route (types, ranges) and business rules in the service (empty body, length, PR state).
- Comment bodies render from GitHub's sanitized `bodyHTML` through `[innerHTML]`, which Angular sanitizes again. Never render raw markdown or user text as HTML yourself.

## Verification
- There is no test suite (no vitest, supertest, jsdom or spec files). Don't add one unless asked.
- Verify with `npm run typecheck` and `npm run build` (the build also enforces the style budgets), then check the page in `npm run dev`.
- **Approve, Queue/Requeue, Comment, Reply and Resolve/Reactivate are real GitHub writes**: a review, an `/azp run` comment, a review comment, or a thread status change. Never try them on real PRs; use a throwaway PR you own.
- Keep logic in pure functions where you can (mappers, `file-tree.ts`, `markdown-format.ts`, `groupThreads`, the `*StatusLine` helpers).

## Server notes
- There's no emit step: `build` is only a typecheck, and the server runs from source via `tsx`.
- `server/repos.config.json` is re-read on every request. Repos not listed are rejected by `RepoService.getConfigured`, which also supplies the canonical owner and name casing.
- Writes are never retried.

## Styling
- ADO look, **light theme only**. Don't add `prefers-color-scheme`. Plain SCSS, no UI library.
- Use the tokens on `:root` in `web/src/styles.scss`, not raw colours. They include:
  - `--primary`, `--ok`, `--bad`, `--bg`, `--surface`
  - `--shadow-card`, `--radius`
  - `--diff-add-bg`, `--diff-del-bg`, `--diff-hunk-bg`
- Patterns to reuse:
  - white cards with `--shadow-card` on the grey page
  - pivot tabs with a 2px `--primary` underline
  - buttons from `ui/shared/_buttons.scss` (`@use` it for `.btn`, `.btn--primary`, `.btn--approve`)
  - `app-status-row` + `app-ci-status-dot` for status rows
  - the global `.sr-only` class
- Styles for `[innerHTML]` content need `::ng-deep`, scoped under a host class (see `review-thread`).
- Budgets in `web/angular.json`: component styles warn at 6 kB and error at 8 kB. Split a component before raising them again.
