# Setup

## Tokens (`server/.env`, gitignored; copy `server/.env.example`)

| Var | Needed for | Permissions |
|-----|-----------|-------------|
| `GITHUB_TOKEN` | Everything on the list and PR pages | Fine-grained. **Read + write:** Pull requests (Approve, the `/azp run` comment behind Queue/Requeue, and review comments). **Read:** Metadata, Contents (full file view in Files Changed), Commit statuses, Checks. Without Checks read, check runs come back FORBIDDEN and the pipeline falls back to GitHub's overall status with a warning. Without Contents read, Files Changed shows only the diff hunks |
| `ADO_PAT` | Pipeline tab (stages, reruns); Story tab later | **Build: Read & execute**; Work Items: Read for the Story tab. If empty, falls back to the `PERSONAL_ACCESS_TOKEN` env var. The org and project of each build come from its check URL |
| `ADO_ORG` / `ADO_PROJECT` | Pipeline tab build lookup (when GitHub checks can't be read), Story tab | Default `nbsdev` / `Services` (also when set but empty) |
| `PORT` | Server port | Default `3000` |

## Repos

`server/repos.config.json` drives the repo dropdown. It's re-read on every request, so no restart is needed. Requests for repos not in it are rejected (404).
