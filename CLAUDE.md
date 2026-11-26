# CLAUDE.md

Guidance for Claude Code in this repo. Keep this file short. Details live in `.claude/rules/` (table below). Add new material there, not here.

## What this is

A personal ADO-style UI for GitHub pull requests. Code lives on GitHub. PR pipelines run in Azure DevOps but report back to GitHub as **check runs**, so pipeline status and Queue/Requeue go through GitHub. The Pipeline tab reads stages from the ADO build timeline and reruns stages or failed jobs through the ADO Build API. ADO will also serve stories (Story tab, not built yet). It's an Angular SPA plus a small Node/Express proxy, so tokens stay server-side. Original phase-1 spec: `project-documentation/pr-lists.txt`.

## Setup

npm workspaces: `contracts` (shared types), `server` (Express 5 + tsx), `web` (Angular 22). Run everything from the repo root.

```bash
npm install
cp server/.env.example server/.env   # set GITHUB_TOKEN — see .claude/rules/setup.md
# edit server/repos.config.json to pick the repos in the dropdown (re-read per request, no restart)
npm run dev        # server :3000 (tsx watch) + web :3333 (ng serve, proxies /api → :3000)
```

Open http://localhost:3333.

## Commands

```bash
npm run dev        # run both apps
npm run typecheck  # server tsc --noEmit
npm run build      # server typecheck + ng build (enforces the style budgets)
```

There is **no test suite**. Verify changes with `npm run typecheck` and `npm run build`, then check the page in the running app.

## Must-follow rules (full list: constraints.md)

- Strict layering: server `api → services → accessors → GitHub`; web `ui → services (stores) → data-access → /api`.
- Every new write endpoint stays behind `api/local-only.ts`, which checks a localhost Host header and the `x-pr-manager: 1` header.
- **Never** click Approve, Queue/Requeue, Rerun (stage / failed jobs), Comment, Reply or Resolve/Reactivate on a real PR to try a change. They are real GitHub writes. Use a throwaway PR you own.
- Light ADO theme only. Use the tokens in `web/src/styles.scss`; no UI library.

## Docs

| File | Contents |
|------|----------|
| [.claude/rules/features.md](.claude/rules/features.md) | What's built (PR list, Overview with overall status and comments, Files Changed, inline comments), behaviour rules, and what's not built yet |
| [.claude/rules/project-structure.md](.claude/rules/project-structure.md) | Folder layout, layers, composition root, and the stores and components in each folder |
| [.claude/rules/server-api.md](.claude/rules/server-api.md) | Endpoints, GitHub GraphQL vs REST access, error mapping, pipeline logic |
| [.claude/rules/constraints.md](.claude/rules/constraints.md) | Layering, security, verification and styling rules, budgets |
| [.claude/rules/setup.md](.claude/rules/setup.md) | Tokens and permissions, `.env`, `repos.config.json` |
