# Blackboard Sync — feature spec

**State at 13 Nov 2026.** Built: phases 1, 2, 3, 4 and 6 (see §10). Not built: the MCP endpoint (phase 5, §8). Both migrations are live. The code is on branch `claude/blackboard-sync-dashboard-44560c`, not yet merged or deployed, so the live site and the installed extension are still the earlier versions; item body text, links and handbook text have not been synced yet.

Pull my own Blackboard Ultra data (assignments, due dates, grades, announcements, course content) into Study Copilot, and make it queryable by Claude. Blackboard is behind Durham SSO + 2FA, so the dashboard server can never log in. Instead **my logged-in browser does the fetching and pushes the results to the dashboard.** In effect it's an API for a system that doesn't give me one.

---

## 1. Core design decision: the browser fetches, the server stores

```
 Chrome (logged in to Blackboard)                Study Copilot (Vercel + Supabase)
 ┌──────────────────────────────┐   POST JSON    ┌──────────────────────────────┐
 │ Extension service worker     │ ─────────────▶ │ /api/blackboard/sync          │
 │  • GET Blackboard REST API   │  Bearer token  │  • validate + normalise       │
 │    with my session cookie    │                │  • upsert bb_* tables         │
 │  • normalise to one payload  │                └──────────────┬───────────────┘
 └──────────────────────────────┘                               │
                                                  Assignments tab · module library · /api/mcp
```

- **No credentials leave the browser.** The extension never sees my password or 2FA. It only rides the session cookie Blackboard already set. The dashboard only ever receives the data.
- **Use Blackboard's own JSON API, not the HTML.** Ultra is a single-page app that loads everything from `/learn/api/...`. Those endpoints return clean JSON, are stable across UI redesigns, and work with the session cookie (verified, §3). No DOM scraping.
- **Read-only.** Only `GET` requests to Blackboard. Never submit, post, mark as read, or change anything there.
- **Text and links, no files.** Content items are stored as titles, body text and links back to Blackboard. One exception: handbooks and assessment briefs (pdf / docx). The extension downloads those, extracts the text in the browser and uploads only the text (`bb_documents`). File bytes are never uploaded or stored, and slide decks (pptx) are never downloaded (§12).

---

## 2. Decisions (answered)

| question | decision |
|---|---|
| Where does the fetching run? | **Private Chrome extension** (Manifest V3, loaded unpacked from `extension/` in this repo). |
| What is synced? | Assignments + due dates, grades/feedback, announcements, course content. |
| When does it sync? | **Three triggers (built):** Sync now in the side panel; a quiet sync when I visit a Blackboard `/ultra` page (at most every 6 h, or 10 minutes after a run that stopped at the login page); a daily `chrome.alarms` pull (skipped if a sync succeeded in the last 20 h). Never two at once. |
| Session expired? | **Extension badge only.** A red `!` on the icon. Clicking it opens Blackboard, and it syncs automatically after login. No Chrome notifications. |
| Where do assignments live? | **Their own tables (`bb_*`)**, not `tasks` / `education_tasks`, so the known Education split is left alone. Nothing in this feature reads or writes those two. |
| Course content → lecture prep | **Suggestions.** The session page has a "From Blackboard" section listing matched items. Pin turns one into a tracked reading; Not relevant hides it. Nothing is auto-attached, and matching never changes prep status. |
| Week numbering | Blackboard folders are inconsistent: some count teaching weeks from 1, some use the university week (e.g. Week 12). **I use the university numbering** (it matches OneNote). Each course has a week offset; see §5. |
| Claude access | **Yes:** a read-only, token-authed MCP endpoint (§8). |

---

## 3. What the read-only probe found (9 Nov 2026)

Host: `https://blackboard.durham.ac.uk` (Ultra). All requests were made from a logged-in tab with the session cookie and no extra headers.

| data | endpoint | result |
|---|---|---|
| Me | `GET /learn/api/public/v1/users/me` | 200 |
| My courses | `GET /learn/api/v1/users/{userId}/memberships?expand=course` | 200. `course.courseId` looks like `GEOG1241_2026`, so it maps to `workspaces.module_code` after stripping `_YYYY` |
| My courses (public) | `GET /learn/api/public/v1/users/{userId}/courses` | 200 (no course details; prefer the private `expand=course`) |
| Due dates (To Do) | `GET /learn/api/v1/calendars/todo/studentItems?since=…&until=…` | 200 for 14–15 days, 400 for 28. Returns `overdueItems` / `dueTodayItems` / `futureDueItems`. Page it in 14-day windows. **Items have no id:** `{ title, dueDate, column, contentVisibility }`, where `column` carries `contentId`, `courseId`, `possible`, `isFormative`… |
| Gradebook columns | `GET /learn/api/public/v2/courses/{id}/gradebook/columns` | 200. `id`, `name`, `contentId`, `score`, `availability`, `grading { type, due, attemptsAllowed, scoringModel }` |
| My grades | `GET /learn/api/public/v2/courses/{id}/gradebook/users/{userId}` | 200. `columnId`, `status`, `displayGrade { scaleType, score, possible }`, `exempt`, `firstRelevantDate`, `lastRelevantDate` |
| Announcements | `GET /learn/api/public/v1/courses/{id}/announcements` | 200. `title`, `body` (HTML), `availability`, `created` |
| Content tree | `GET /learn/api/public/v1/courses/{id}/contents` (+ `/{contentId}/children`) | 200. `title`, `parentId`, `contentHandler`, `availability`, `links` |

Gotchas found:
- **The Ultra page sets a `<base href>` to a CloudFront CDN**, so relative URLs go to the wrong host and 404. Always use absolute `https://blackboard.durham.ac.uk/...` URLs.
- The page also exchanges an OAuth access token (`oauth2/tokeninfo`), but **the cookie alone is enough** for every endpoint above. Don't touch the token.
- Responses are paged (`paging.nextPage`). Follow it.
- Coursework submitted via Turnitin/external tools may only show in the To Do feed, not in the gradebook. Treat To Do as the primary source of due dates and the gradebook as the source of grades.

---

## 4. Chrome extension

`extension/` folder, plain TypeScript built with a tiny esbuild script (no framework).

- **`manifest.json`**: MV3; `host_permissions`: `https://blackboard.durham.ac.uk/*` and `https://*.blackboard.com/*` (handbook downloads redirect there). The dashboard origin is granted at runtime: `optional_host_permissions` covers `https://*/*` and `http://localhost/*`, and saving the dashboard URL in the side panel asks Chrome for exactly that one origin. `permissions`: `alarms`, `storage`. No `tabs`/`cookies`/`webRequest` permissions are needed.
- **Service worker**
  - `sync()` runs: `users/me` → memberships (current term only) → per course: gradebook columns, my grades, announcements, content tree (depth-limited, e.g. 4 levels) → To Do feed in 14-day windows from −14 to +84 days. Courses are fetched sequentially with a small delay. It's one user, so there's no reason to hammer the API.
  - `POST`s the raw snapshot (`BbSnapshot` in `lib/blackboard/client.ts`) to `/api/blackboard/sync` as `{ trigger, snapshot }`. The server normalises it (`lib/blackboard/normalise.ts`), so mapping fixes never need an extension reload.
  - **Auth check:** a 401/403, or a redirect to the SSO host from `users/me`, means the session has expired. It sets badge `!` (red), stores `needsLogin = true`, and stops.
  - Triggers: see §2 (`extension/src/triggers.ts`). Automatic runs are silent: logged out sets the `!` badge and waits for the next trigger.
- **Side panel** (replaced the popup): last synced time, counts, **Sync now**, whether the dashboard saved it, and a Dashboard card for the URL + sync token (`chrome.storage.local`), entered once.
- **Verify in phase 1:** whether service-worker fetches carry the Blackboard cookie (they should with host permissions; SameSite rules for extension requests). Fallback: run the fetch from a content script inside an open Blackboard tab.
- **Handbooks:** after an upload the server's reply lists the handbook / brief documents it wants (§12). The extension downloads them, extracts text (PDF: `unpdf`; Word: `docx-text.ts`) and posts it to `/api/blackboard/document`. Version 0.4.0.
- **Expect frequent badge prompts:** Durham sessions expire after hours of idling, so the daily background pull will often find the session gone. The on-visit sync is what will usually keep data fresh.

---

## 5. Data model

All tables: `user_id default auth.uid()`, four own-row RLS policies, `revoke … from anon`, `grant … to authenticated`. Re-runnable migration, applied by hand. Upsert keyed on `(user_id, bb_id)`. **Never hard-delete:** rows that vanish from Blackboard get `removed_at`. Each row keeps `first_seen_at` / `last_seen_at`.

| table | key columns |
|---|---|
| `bb_courses` | `bb_id`, `course_code` (`GEOG1241_2026`), `module_code` (`GEOG1241`), `name`, `term`, `workspace_id` (nullable, auto-matched on `workspaces.module_code`, manual override), `week_offset int default 0`, `url` |
| `bb_assignments` | `bb_id` (To Do item / column id), `course_id`, `title`, `due_at timestamptz`, `bb_content_id`, `status` (`not_submitted` / `submitted` / `graded`, from Blackboard), `url` |
| `bb_grades` | `bb_id` (the gradebook column id), `course_id`, `assignment_id` nullable, `score`, `possible`, `display_grade`, `feedback` (plain text), `released_at` |
| `bb_announcements` | `bb_id`, `course_id`, `title`, `body_text` (HTML stripped server-side), `posted_at`, `url`, `read_at` (dashboard-side only) |
| `bb_content` | `bb_id`, `course_id`, `parent_bb_id`, `title`, `kind` (`folder` / `document` / `link` / `file` / `assignment` / …), `available_from`, `path` (breadcrumb of folder titles), `week_label int` (parsed from the title, e.g. "Week 5"), `url` |
| `bb_sync_runs` | `started_at`, `finished_at`, `trigger` (`manual` / `visit` / `daily`), `ok`, `counts jsonb`, `error`. Append-only, used for "last synced" |

Added by `20261113000000_blackboard_work.sql` (live):

| table / column | |
|---|---|
| `bb_content.body_text`, `links`, generated `body_hash` | sync-owned. `links` = `[{ href, label, kind }]`, kind talis / panopto / file / slides / other |
| `bb_announcements.body_hash`, `bb_assignments.is_formative` | sync-owned |
| `bb_documents` | handbook / brief text per content item (`text`, generated `text_hash`, `version`, `removed_at`). Text only |
| `bb_content_ai` | per content item: `role`, `uni_week` (the week number as written), `session_type`, `lecture_ordinal`, `explicit_date`, `classified_hash`, `extracted_hash` |
| `bb_key_dates` | AI-found dated work: `title`, `category`, `due_on`, `quote`, `status` (suggested / confirmed / dismissed), exactly one source id (announcement, content or document), `fingerprint` |
| `bb_session_overrides` | `hide` / `attach` a content item for a session UID |
| `bb_assignments.done_at`, `bb_announcements.ai_hash`, `bb_documents.ai_hash` | dashboard-owned |
| `user_settings.work_filter`, `week_one_start` | dashboard-owned |

A sync never writes a dashboard-owned column or table. The sync routes use the service-role client, so every table they touch also has `grant … to service_role`.

**Week mapping.** University week = `week_label + bb_courses.week_offset`. Matching a content item to a timetable session tries, in order:
1. a date in the item's or an ancestor's title;
2. lecture number (numbered series, including series that restart per block, flagged as inferred);
3. the mapped university week (`lib/blackboard/match.ts`; per-course calibration when `week_offset` is 0).

An item that resolves to one session matches only that session, and coursework never lands on a session. Matches are only *suggestions*. Pinning one creates the usual `workspace_links` row with `session_uid`, so the existing prep traffic light is unchanged until I act.

Dates are stored as UTC and shown as Europe/London days (`lib/google/london-day.ts`). Pure normalisers (`lib/blackboard/normalise.ts`: code parsing, week-label parsing, HTML stripping, To Do → assignment mapping) get `normalise.test.ts`.

---

## 6. API

| route | |
|---|---|
| `POST /api/blackboard/sync` | Body `{ trigger?, snapshot: BbSnapshot }`. Validates the structure (`parseSyncBody`, hand-written like `lib/timer/validate.ts`; no new dependency), normalises, upserts everything in one RPC/transaction (`bb_sync_apply`), marks missing rows `removed_at` **only for courses included in this payload**, writes a `bb_sync_runs` row. Returns counts |

**Auth:** `lib/blackboard/auth.ts`, the same shape as `lib/timer/auth.ts`. The extension sends `Authorization: Bearer $BLACKBOARD_SYNC_TOKEN`, acts as `BLACKBOARD_OWNER_USER_ID`, and uses the service-role client. Token only: there's no cookie fallback, since only the extension calls it. The token is accepted only on `/api/blackboard/*` and `/api/mcp`. Add `/api/blackboard` to `PUBLIC_PATHS` in `proxy.ts`. Add the env var names to `.env.example`. A separate token from `TIMER_API_TOKEN`, so leaking one doesn't open the other.

| `POST /api/blackboard/document` | Handbook text from the extension (token auth) → `bb_documents`. Text only |
| `POST /api/work/process` | One unit of AI work (§13). Login session, not the token; outside the public `/api/blackboard` prefix |

No AI in the sync path.

---

## 7. Dashboard UI (built)

- **`/lectures`**: a sync line (when Blackboard last synced, what the AI read), then one work list (`WorkList`) built from official assignments, key dates, timetable Test sessions and lecture prep (`lib/blackboard/work.ts`). Tabs Upcoming / Past due / Completed; type chips (multi-select, lecture prep is one); a module filter. The choice is saved in `user_settings.work_filter`. Upcoming shows 10, then three months, then a year, then all. Blackboard's submitted / graded status beats my own done mark. AI-found dates show as suggested until I confirm, re-date or dismiss them.
- **Module workspace**: its lectures section is the same list, locked to the module.
- **Session page**: a "From Blackboard" section: slides, readings, recordings, other; Pin, Not relevant (hidden items can be restored); announcements about the session. The calendar popover shows a one-line count.
- **Calendar**: standalone deadlines are a `deadline` item and open in an anchored popover.
- **Home**: the `due-soon` widget (deadlines and tests in the next 7 days).
- Follows `DESIGN.md` and shared components.

---

## 8. MCP endpoint

`/api/mcp`: a read-only MCP server (Streamable HTTP) with the same bearer-token auth. Tools:

| tool | returns |
|---|---|
| `list_assignments` | `{ status?, module?, due_before? }` → assignments with due dates and status |
| `get_grades` | `{ module? }` → released grades + feedback |
| `list_announcements` | `{ module?, since?, unread_only? }` |
| `search_content` | `{ query, module? }` → content items (title/path `ilike`, no AI) |
| `sync_status` | last sync time, whether it's stale |

The data comes only from Supabase, never live from Blackboard. Nothing in the MCP writes.

---

## 9. Edge cases

- Session expires mid-sync → abort without posting a partial payload (or post only finished courses and mark the run partial). Never mark rows `removed_at` from a partial run.
- Course codes without a matching workspace → listed in a "Link Blackboard courses" prompt; never auto-create workspaces.
- Due date changed on Blackboard → update `due_at`, and keep the previous value in `bb_sync_runs.counts` as a changed-items list.
- An item submitted on Blackboard but not Marked as done here → counts as Completed (Blackboard status wins for submittable items).
- Previous-year courses (`_2025`) → ignored by default (current term only).
- Durham changes SSO or the API → the extension shows a badge `?` with the HTTP error; the dashboard keeps the last good data.

---

### What is built (13 Nov 2026)

Handbook reading (§12), the AI pass (§13), the work list and matching, the session page section, calendar deadlines, the Due soon widget, and extension 0.4.0 with the three triggers. Not built: the MCP endpoint, and a picker to attach an item to a session by hand (the override exists; only hide / restore have UI).

### Phase 1 result (9 Nov 2026)

`lib/blackboard/client.ts` ran live in a logged-in tab: **all 10 current courses, 551 content items (max folder depth 3, none skipped), 20 announcements, 12 gradebook columns, 8 released grades, 2 To Do items, 0 errors, 318 requests in 106 s.** Five courses are org courses (`X_*`) with no module code. Still to confirm once the extension is loaded unpacked: whether the **service worker's** own fetches carry the cookie (the popup reports `via the background worker` or `via the open Blackboard tab`).

### Phase 2 result (9 Nov 2026)

Built: `supabase/migrations/20261109000000_blackboard_sync.sql` (applied to the live DB on 12 Nov 2026), `lib/blackboard/normalise.ts` + tests, `lib/blackboard/auth.ts`, `POST /api/blackboard/sync`, and the extension's upload plus Dashboard card. The migration and `bb_sync_apply` were checked in PGlite (Postgres in WASM): the migration re-runs cleanly; re-posting a snapshot changes nothing but `last_seen_at`; RLS hides other users' rows; anon is denied.

How removal is scoped (never from a partial read):
- **Courses**: missing from memberships → `removed_at` (memberships never come back partial: a lost session aborts the snapshot). Their child rows are left as they were.
- **Grades, announcements, content**: only in courses whose section came back without errors. Content also needs `skippedFolders = 0`.
- **Assignments** merge To Do items (primary for due dates; the only source for Turnitin) and the gradebook's coursework columns (tied to content or due; not calculated). Both are keyed by `todoItemKey`. A missing assignment is removed only if its course's columns were read cleanly, every To Do window came back, and it's undated or due inside the To Do range. Older coursework that has scrolled out of the window is kept.
- `bb_sync_runs.counts` holds row counts, removals, `due_changed` (`{ bb_id, title, from, to }`), items skipped because their course wasn't in the snapshot, and the snapshot's errors.

Still to confirm against live data: the To Do item's `column.courseId` (internal id or course code; both are matched), and whether gradebook `status` (`Graded` / `NeedsGrading`) is a good enough submission status.

---

## 10. Phases

| phase | scope | state |
|---|---|---|
| **1. Extension spike** | Sync button, fetch every endpoint in §3, Download JSON, badge on login loss | built |
| **2. Schema + sync API** | migration, `lib/blackboard/*` normalisers + tests, `/api/blackboard/sync`, token auth, proxy entry | built, live |
| **3. Work list** | `/lectures` work list instead of an Assignments tab (§7) | built |
| **4. Content + announcements** | item text and links, handbook text, AI key dates, session matching and the "From Blackboard" section | built, not yet deployed |
| **5. MCP** | `/api/mcp` tools in §8 | not built |
| **6. Triggers polish** | daily alarm, on-visit sync, badge flow | built |

Each phase is its own Claude Code session.

---

## 11. Open questions

**Not planned unless asked for** (ideas only; nothing is built for them):
- "Plan this": copy an assignment into `education_tasks` for Daily Goals / time-blocking.
- A picker to attach a Blackboard item to a session by hand.
- Downloading slide decks or any other file type.
- A dashboard banner for login loss (the extension badge covers it).

Built since the first plan: "Mark as done" for coursework (`bb_assignments.done_at`), due dates on the calendar, a "last synced" line on `/lectures`, and AI reading of announcements, items and handbooks (§13).

Questions:

- Is the week offset the same for every module in a term, or does it vary by module? (The schema supports per-course; the UI could default to one term-wide value.)
- Durham's IT acceptable-use policy: reading my own data with my own session at a gentle rate should be fine, but check that it doesn't forbid automated access.
- Once phase 1 shows the To Do item shape: does it cover Turnitin/external-tool coursework, and does it carry submission status?

---

## 12. Handbooks and briefs

- After a successful upload the sync response lists `wanted` content items (`lib/blackboard/documents.ts`): items whose title, folder path or file name looks like a handbook or assessment brief, pdf and docx only, at most 10 per course. Anything I marked "read with AI" is wanted too.
- The extension lists each item's attachments (GET), skips files whose version the dashboard already has, downloads at most 30 per sync (15 MB cap), extracts text in the service worker and posts only the text to `/api/blackboard/document`. Needs site access to `*.blackboard.com`. Files it could not read are remembered by id + version and not fetched again.
- Never uploaded or stored: file bytes. Never downloaded: pptx.
- Untested in a real browser: the redirect download and PDF extraction in the service worker.

## 13. AI pass

`lib/blackboard/ai/`, all calls through `lib/ai/gemini.ts`. Runs from the dashboard (`POST /api/work/process`, looped by `useBbProcessing` from the `/lectures` sync line), one unit per request.

- Classify content items (`bb_classify`, fast tier) and extract dated work from announcements, item text and documents (`bb_extract_*`, smart tier with thinking).
- A row is processed only when its generated hash differs from the one recorded last time; text with no date signal costs nothing; `retry:` / `fail:` / `partial:` markers park failing rows.
- Own daily cap `BB_DAILY_CALL_CAP` (80), separate from the shared one. Every call is logged to `ai_usage`.
- A key date is kept only if its verbatim quote from its own source states the date. Relative dates need the source's posted day and are checked against the module's timetable. Dismissed never returns; confirmed is never overwritten; official Blackboard dates are never edited.
- Announcements annotate: a note on the matching assignment or item, or a line on the session, and a row of their own only when nothing else matches.
- `npm run bb:eval` scores the real prompts on fixtures in gitignored `tmp/bb-eval/` (real, paid calls).
