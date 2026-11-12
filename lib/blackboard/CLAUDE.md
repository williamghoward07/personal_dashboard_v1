# Blackboard sync

Spec: `docs/specs/blackboard-sync-spec.md`. Phases 1 (extension) and 2 (schema + sync API) are built. The migration `20261109000000_blackboard_sync.sql` may not be applied yet.

- `client.ts` fetches from Blackboard. It's pure: fetch is injected, and it's bundled into the Chrome extension (`extension/`, `npm run build:extension`). It must stay free of `server-only`, Next and Supabase imports.
- It runs in my logged-in browser and rides Blackboard's session cookie. Never handle passwords, 2FA, or the OAuth token that Ultra's page exchanges (`oauth2/tokeninfo`).
- GET only. Never submit, post or mark anything on Blackboard.
- Links and metadata only. Never download files.
- Always use absolute URLs (`absoluteUrl`): the Ultra page's `<base href>` points at a CloudFront CDN.
- The To Do feed (`/learn/api/v1/calendars/todo/studentItems`) rejects windows of 28 days or more. Use `todoWindows` (14 days).
- To Do items have no id (`{ title, dueDate, column, contentVisibility }`). Key them with `todoItemKey`.
- A lost session anywhere aborts the whole snapshot (`BbLoginRequiredError`). Never sync a partial snapshot: the server will mark missing rows removed.
- Org courses (`X_*_2026`) have no module code (`parseCourseCode`).
- `normalise.ts` maps a `BbSnapshot` to `bb_*` rows (also pure). `/api/blackboard/sync` validates (`parseSyncBody`), normalises, and applies everything in one transaction with the `bb_sync_apply` RPC. Auth is `auth.ts`: `BLACKBOARD_SYNC_TOKEN` only, acting as `BLACKBOARD_OWNER_USER_ID`.
- Removal is scoped: rows are only marked `removed_at` in course sections that were read without errors (`scopes` in the payload), and assignments only inside the To Do window. Never widen this, or a failed request would "remove" real coursework.
- `bb_announcements.read_at` and `bb_courses.workspace_id` / `week_offset` are dashboard-side. A sync never overwrites them (it only fills `workspace_id` while it's null).
- Keep requests gentle (`delayMs`, default 150). A full sync is about 320 requests in about 2 minutes.
