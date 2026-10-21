# Workspaces UI

- Colour comes from the workspace `color`, then the nearest folder ancestor with a colour, then teal (`resolveAccent`). It's exposed as the `--ws-accent` CSS variable and the `ws-accent` Tailwind token. Don't pass colour props.
- When behaviour changes, update the (i) help in `WorkspacesHelp.tsx` to match.
- Folder cycles are blocked by DB triggers. Deleting a folder moves its contents up a level.
- Completed sources (`workspace_links.completed_at`) are skipped by Launch set and the Sources stat, and exported under "### Completed".
- A reading is a link with `is_reading`, a `week` or a `session_uid` (`isReading`): split with `splitReadings` before passing links to Sources, Launch set or the stats. Readings stay in their week/session when ticked.
- A workspace with `module_code` is a module workspace: it's listed on `/lectures` (not `/workspaces`), shows `LecturesSection` (sessions from `lib/timetable`, readings by `session_uid`), and never shows the week-based Readings column.
- `readings` and `time` sections start hidden (DB default); they're for uni-module workspaces. Study time is a stat card, not a column.
- The Markdown export always includes every section, even hidden ones.
- Keep logic in `lib/workspaces/*.ts`, with tests alongside.
