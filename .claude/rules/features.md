# Features

## Built

### PR list (`/`)
- Repo picker (from `server/repos.config.json`), filters All / Mine / Review requested, and search.
- Shows each PR's CI, draft and conflict state.

### PR detail (`/repos/:owner/:repo/pull/:number`)
- The header has an ADO state badge (Active / Draft / Completed / Abandoned) and an **Approve** button.
- Tabs: Overview / Files Changed / Story / Commits / Pipeline. Story and Commits render `ComingSoonTab`.

### Overview tab
- An **overall status** card sits on top (`overallStatusLine`): ✓ "All required checks succeeded", ✗ "X of N required checks failed", or pending "X of N required checks pending". The subtitle summarises optional checks ("Optional check succeeded").
  - Required: pipeline, merge conflicts, comments, and approvals when GitHub reports a review requirement. Approvals are optional when it reports none.
  - A required row passes only on SUCCESS. FAILURE and NONE (not queued, canceled, unavailable) count as failed. Rows still loading count as pending.
- **Pipeline status** comes from GitHub checks. Every check is listed, and failure details show in a console box.
- There is **one** pipeline button: **Queue** before the PR's first Azure Pipelines run, **Requeue** after. Both post an `/azp run` comment (logic in server-api.md).
- After Queue or Requeue, the row shows "Run requested" and the button stays disabled. It clears when GitHub reports a different state, or after 3 minutes.
- The pipeline is polled every 15s while it is running or a run was requested.
- After a run, a **View stages** button links to the Pipeline tab.
- The tab also shows approvals, merge conflicts and the PR description.
- **Comments** status row: "No comments", "N active comments" (red) or "All comments resolved" (green), with "X of Y resolved".
- Below the description, a **Comments** section lists every review thread, newest activity first (a fresh reply moves a thread to the top), with All / Active / Resolved filters. Each ADO-style thread card shows:
  - the file name and path, the line, and the last 8 diff lines it was written on (its line marked)
  - a header with a round file-type badge, the file name and path, the line, and the time of the latest comment
  - each comment as avatar, name and time with the body indented below; the first comment carries the status dropdown (Active / Resolved) and an Outdated pill
  - a bottom row: your avatar, a "Write a reply…" box that opens the comment box, and a **Resolve** / **Reactivate** button
  - the same thread card is used inline in Files Changed (framed there)
- Resolve / Reactivate only show when GitHub says the viewer may (`viewerCanResolve` / `viewerCanUnresolve`). A failure shows on that thread only.

### Files Changed tab (ADO-style)

**Tree (left)**
- Folders are collapsible. A chain of single sub-folders is joined into one row (`src/WebSpa`).
- Files show text badges (`M↓` Markdown, `C#`, `TS`, …) and status marks (`+` added, `−` deleted, `R` renamed).
- Each file shows its comment count.

**File view (right)**
- Clicking a file shows **that whole file** on the right. The page doesn't scroll, and the tree and the file scroll separately. The first file is selected by default.
- Edited files show old / new line numbers, with added lines green and marked `+` and deleted lines pink and marked `−`.
- Added and deleted files show a single number column with no highlight.
- The diff hunks (already in the file list) show **instantly**; the whole file replaces them when it arrives. If the whole file can't be fetched, the hunks stay, with a note.
- Long unchanged stretches collapse into "Show N unchanged lines" rows, keeping 8 lines of context around changes and comments. Very long files render 1500 rows at a time, with a "Show more" button.

**Inline review comments**
- Hovering a line inside a diff hunk shows a comment button in the gutter, which opens the ADO-style comment box:
  - avatar and textarea, with "Markdown supported."
  - a toolbar for bold, italic, code, link, bullet, numbered and task lists
  - Cancel / Comment, Ctrl+Enter to post, Esc to cancel
- GitHub rejects comments on lines outside the hunks (422), so the button only shows on lines with `commentable: true`.
- Existing review threads from every developer render under their line. Each shows its author, time, the GitHub-rendered markdown body, an Active / Resolved / Outdated pill, a Resolve / Reactivate button, and a Reply box.
- Comments on deleted lines anchor to the base side (`LEFT`); all others anchor to the head (`RIGHT`). Unchanged lines also show threads on their base-side line.
- Outdated threads (their line changed since) are placed at their **original line**, or the nearest earlier line, and show an Outdated pill. Only threads GitHub gives no line for at all are listed at the top.
- Threads reload each time the tab opens. Posting returns the refreshed list. A failed post keeps the box open and shows GitHub's message.

### Pipeline tab (ADO-style stages)
- One card per Azure Pipelines build on the PR: state, name, a link to the build in ADO, and **Rerun failed jobs** when the finished build has failed or canceled jobs.
- Below it, a Stages pane: a collapsible **All Stages** list on the left and the stage graph on the right. The graph puts each stage one column right of its deepest dependency, with ADO-style connector lines; lines touching the selected stage turn blue. Picking a stage in the list selects it and scrolls it into view.
- Each card shows its state (including the orange "succeeded with issues"), "N jobs completed" and duration. Clicking the header expands or collapses it; running, failed, warning and canceled stages start expanded, showing their jobs with durations.
- If stage dependencies can't be read (`hasGraph: false`), the cards show in one row in run order with no lines.
- Expanded failed, canceled or warning stages show a **Rerun just this stage** split button (failed jobs). The dropdown offers "Rerun failed jobs" / "Rerun all jobs". Reruns are real ADO writes, and only show while the PR is open.
- Needs `ADO_PAT` (Build: Read & execute); the tab shows a setup hint on 401/403. GitHub Checks read is optional: without it, builds are looked up in ADO by the PR's merge ref.
- Clicking a job in a stage card opens the **job view** (replaces the stage pane; "Back to stages" returns):
  - left: the job's steps with state and duration; the first failed step is picked by default
  - right: the step's errors and warnings from the timeline, then its log in a dark console with line numbers. `##[error]` / `##[warning]` / `##[section]` / `##[command]` lines are coloured. It opens at the first error, with ↑ / ↓ to jump between errors. Only the last 10,000 lines are sent.
  - a running step's log refreshes with each build poll
- Polls every 10s while a build is running, and for 2 minutes after a rerun. A failed rerun shows on that stage or build only.

## Not built yet

- Story tab (ADO work item, using `ADO_PAT`)
- Commits tab
- Pipeline tab: Jobs pivot, job logs, artifacts
- Merge
- In Files Changed:
  - multi-line comments
  - pending reviews (batching comments into one review)
  - syntax highlighting
  - @mentions and attachments in the comment box
