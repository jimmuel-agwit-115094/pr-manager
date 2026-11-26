# PR Manager

Personal ADO-style UI for GitHub pull requests (pipelines live in ADO).

## Run

```bash
npm install
cp server/.env.example server/.env   # add GITHUB_TOKEN
npm run dev                          # server :3000 + web :3333
```

Open http://localhost:3333. Edit `server/repos.config.json` to change the repo dropdown (no restart needed).

## Layout

| Folder | Layer | Rule |
|--------|-------|------|
| `contracts/` | Shared DTOs | No deps |
| `server/src/api` | HTTP routes, error mapping | Calls services only |
| `server/src/services` | Filters, mapping, cache | Calls accessors only |
| `server/src/accessors` | GitHub GraphQL, config file | Raw data, no rules |
| `web/src/app/data-access` | HttpClient wrappers | No state |
| `web/src/app/services` | Signal stores, prefs | Calls data-access |
| `web/src/app/ui` | Pages, components, pipes | Injects stores only |

## Verify

```bash
npm run typecheck   # server
npm run build       # server typecheck + web build
```

There is no test suite.

Spec: `project-documentation/pr-lists.txt`.
