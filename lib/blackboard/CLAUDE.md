# Blackboard sync

Spec: `docs/specs/blackboard-sync-spec.md`. Built: the extension, schema + sync API, handbook text, the AI pass, the work list on `/lectures`, the session page's "From Blackboard" section, calendar deadlines and the Due soon home widget. Not built: the MCP endpoint. Migrations `20261109000000_blackboard_sync.sql` and `20261113000000_blackboard_work.sql` are live (applied 12 Nov 2026).

## Reading Blackboard (extension)
- `client.ts` fetches from Blackboard. It's pure: fetch is injected, and it's bundled into the Chrome extension (`extension/`, `npm run build:extension`). It must stay free of `server-only`, Next and Supabase imports. So must `normalise.ts`, `links.ts`, `documents.ts`, `docx-text.ts`, `wire.ts` and `gzip.ts`.
- It runs in my logged-in browser and rides Blackboard's session cookie. Never handle passwords, 2FA, or the OAuth token that Ultra's page exchanges (`oauth2/tokeninfo`).
- GET only. Never submit, post or mark anything on Blackboard.
- Metadata, item text and links only, with one exception: handbooks and assessment briefs (see Documents). Never download anything else, and never store or upload file bytes. Slide decks (pptx) are never downloaded.
- Always use absolute URLs (`absoluteUrl`): the Ultra page's `<base href>` points at a CloudFront CDN.
- The To Do feed (`/learn/api/v1/calendars/todo/studentItems`) rejects windows of 28 days or more. Use `todoWindows` (14 days).
- To Do items have no id (`{ title, dueDate, column, contentVisibility }`). Key them with `todoItemKey`.
- A lost session anywhere aborts the whole snapshot (`BbLoginRequiredError`). Never sync a partial snapshot: the server will mark missing rows removed.
- Org courses (`X_*_2026`) have no module code (`parseCourseCode`).
- Keep requests gentle (`delayMs`, default 150). A full sync is about 320 requests in about 2 minutes.
- Triggers (`extension/src/triggers.ts`): Sync now; a daily alarm (skipped if a sync succeeded in the last 20 h); visiting a Blackboard `/ultra` page (at most every 6 h, or 10 minutes after a run that stopped at the login page). Never two syncs at once.

## Sync API
- `wire.ts` is the contract shared by the extension and the server. The upload is gzipped JSON (`gzip.ts`); plain JSON is still accepted.
- `normalise.ts` maps a `BbSnapshot` to `bb_*` rows. `/api/blackboard/sync` validates (`parseSyncBody`), normalises, and applies everything in one transaction with the `bb_sync_apply` RPC. Auth is `auth.ts`: `BLACKBOARD_SYNC_TOKEN` only, acting as `BLACKBOARD_OWNER_USER_ID`.
- The sync routes use the service-role client. Every table they or `bb_sync_apply` touch needs a plain `grant … to service_role`, or the sync fails silently.
- Removal is scoped: rows are only marked `removed_at` in course sections that were read without errors (`scopes` in the payload), and assignments only inside the To Do window. Never widen this, or a failed request would "remove" real coursework.
- `normalise.ts` keeps each content item's body text (`body_text`), embedded links (`links`: talis / panopto / file / slides / other) and `bb_assignments.is_formative`. Signed or session URLs (`resourceUrl`, `viewerUrl`, `/sessions/`) are never stored (`links.ts`): a file is a link to the item that holds it.
- Sync-owned: `bb_content.body_text` / `links` and `bb_assignments.is_formative`. `body_hash` (content, announcements) and `text_hash` (documents) are generated columns.
- Dashboard-owned, never written by a sync: `bb_announcements.read_at`, `bb_courses.workspace_id` / `week_offset` (a sync only fills `workspace_id` while it's null), `bb_assignments.done_at`, the `ai_hash` columns, and the tables `bb_content_ai`, `bb_key_dates`, `bb_session_overrides`. Also `user_settings.work_filter` and `week_one_start`.

## Documents
- The sync response lists handbook / assessment-brief items it wants (`documents.ts`: pdf and docx only, capped per course). The extension downloads them, extracts the text in the browser (`extension/src/pdf-text.ts`, `docx-text.ts`) and posts text only to `POST /api/blackboard/document` → `bb_documents`.
- Downloads redirect to `*.blackboard.com`, so the extension has site access to it. Files it couldn't read are remembered by id + version and not fetched again.

## AI (`ai/`)
- Runs from the dashboard, never the extension: `POST /api/work/process` (login session; deliberately outside the public `/api/blackboard` prefix), looped by `useBbProcessing`, which only the sync line on `/lectures` mounts. One unit of work per request.
- Two jobs: classify content items (`bb_classify`, fast tier) and extract dated work from announcements, content titles/bodies and documents (`bb_extract_*`, smart tier with thinking). All calls go through `lib/ai/gemini.ts`.
- Never re-read unchanged data. A row is processed only when its generated hash differs from the hash recorded when it was last processed. Text with no date signal costs nothing. `retry:` / `fail:` / `partial:` markers in the hash columns park failing rows and track part-read documents (`markers.ts`).
- Blackboard AI calls have their own daily cap (`BB_DAILY_CALL_CAP`, 80), separate from the shared one. Every call is logged to `ai_usage`; thinking tokens count towards cost.
- Grounding is done in code, never trusted to the model (`grounding.ts`, `quote-dates.ts`, `sessions.ts`). A key date is kept only if its verbatim quote from its own source states the date. A relative date needs the source's posted day and is checked against the module's timetable sessions. Dismissed never returns, confirmed is never overwritten, and the AI never edits official Blackboard dates.
- `npm run bb:eval` scores the real prompts on labelled fixtures in gitignored `tmp/bb-eval/`. It makes real, paid calls.

## Work list and matching
- `work.ts` builds one `WorkItem` list from official assignments, key dates, timetable Test sessions and lecture prep. Blackboard's submitted / graded status beats my own done mark. Work set for a session folds into that session's row.
- Content and handbooks are the primary source. An announcement only annotates: a note on the matching assignment or content item, or a line on the session. It is a row of its own only when nothing else matches.
- `match.ts` matches content to timetable sessions: a date in the item's or an ancestor's title, then lecture number (numbered series, including ones that restart per block, flagged as inferred), then week (per-course calibration between teaching weeks and Durham university weeks). An item that resolves to one session matches only that session. Coursework never lands on a session. Matching never changes prep status.
- Nothing in this feature reads or writes `tasks` or `education_tasks`.
- Pinning a Blackboard item on the session page makes a tracked reading through the existing `workspace_links` path. Until then it's only suggested.
