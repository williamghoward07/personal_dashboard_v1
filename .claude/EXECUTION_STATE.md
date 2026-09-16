# Execution State — Workspaces / App Library / To Do / Capture / Routine / Instagram batch (2026-09-16)

Plan: `C:\Users\William\.claude\plans\allow-me-to-hide-replicated-possum.md`

## Current task
None: every phase is written. Nothing after the baseline commit `ddadccf` is committed yet (William hasn't asked for a commit).

## Done (uncommitted)
- **Phase 1: bug fixes.**
  - `onActivateKey` stops Space/Enter inside inputs from triggering the whole row (rename a source; todo rows; App Library tiles and others).
  - The link editor no longer drags, so text can be selected.
  - "Launch set" reports blocked tabs and offers "Open next".
- **Phase 2:** `Popover` / `InfoPopover` and the Workspaces (i) help.
- **Phase 3: App Library.**
  - All folders open by default.
  - A **+** in each folder toolbar adds a link straight into that folder.
  - Drag and drop reorders folders and links, including moving links across folders.
- **Phase 4: Workspaces.**
  - Nested folders.
  - A colour for each workspace and each folder.
  - Hide and collapse for sections.
  - Custom #tags on the thinking log.
- **Phase 5:** Workspaces home widget, and a workspace chip on todos (Todos rows, detail view, Daily Goals).
- **Phase 6: Microsoft To Do replaces Apple Reminders.** The CalDAV sync never worked because iCloud only serves placeholder lists.
  - Stars on todos.
  - "Starred" filter.
  - Sync status bar with Connect/Reconnect.
  - Daily Goals capped at 5 open rows, with starred todos included.
  - Throttled pull from the home page.
  - The `tsdav` package was removed.
- **Phase 7: the query box has Auto/Find/Ask/Capture modes.**
  - Capture reuses the brain-dump extractor.
  - Every draft needs a confirm, with "Confirm all".
  - Shared `DraftList`.
  - The old single-item Act route was deleted.
  - Confirm moved to `/api/capture/confirm`.
- **Phase 8: habit steps and the morning routine.**
  - Core and bonus steps.
  - The RPC logs a completion once every core step is ticked.
  - Home card, setup modal, and a steps editor in the habit form.
  - London dates in the habits UI.
  - The `habits:changed` event.
- **Phase 9: Instagram log.**
  - Screenshots go to Claude, and its JSON is pasted into the app.
  - RPC import, a preview before import, and "Add to People" or link to an existing contact.
  - `.claude/skills/instagram-log`.
- **Phase 10:** CLAUDE.md rewritten; `.env.example` updated; the `docs/FEATURE_INVENTORY.md` todo entry updated.

## Migrations: all applied to the live DB via the Supabase connector (with William's approval)
- `20260917000000_workspace_folders_layout_tags.sql`
- `20260917010000_todos_starred_and_mstodo.sql`
- `20260917020000_habit_steps.sql`: RPC checked with a test that rolled itself back.
- `20260917030000_instagram_log.sql`: RPC checked with a test that rolled itself back.

## Blockers: all need William
- **Microsoft To Do has never run against a real account.**
  - Add the `Tasks.ReadWrite` delegated permission to the Azure app registration.
  - Then reconnect: `/todos` → Connect/Reconnect.
- **Not checked in a browser.** The app needs a login and there's no browser tool, so the dev-server smoke test only reached `/login`. Pages to click through:
  - `/workspaces` and a workspace detail page: folders, colours, layout, tags, launch set
  - `/apps`: drag and drop, and **+** on a folder
  - `/todos`: stars, filter, sync bar
  - Home: Daily Goals cap, Morning routine setup, query box modes, Capture → Confirm all
  - `/habits`: steps editor, "Morning routine" button
  - `/people`: Instagram import, baseline first
- **Still open, not part of this batch:**
  - `tasks` / `education_tasks` split: a captured education task counts on Daily Goals but doesn't show in Education.
  - `20260826000000_notes_documents.sql` is still unapplied on the live DB.

## Test/build status
- `tsc` is clean.
- vitest: 325/325 pass.
- `npm run build` succeeds. The stale `.next/dev/types` had to be cleared first.
- Lint: 35 errors, all `react-hooks/set-state-in-effect`, all already present at HEAD. Files I touched were checked against their HEAD versions. No new errors.
