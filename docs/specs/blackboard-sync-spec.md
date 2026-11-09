# Blackboard Sync — feature spec

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
- **Data only, no files.** Content items are stored as titles plus deep links back to Blackboard. PDFs and slides are never downloaded or copied.

---

## 2. Decisions (answered)

| question | decision |
|---|---|
| Where does the fetching run? | **Private Chrome extension** (Manifest V3, loaded unpacked from `extension/` in this repo). |
| What is synced? | Assignments + due dates, grades/feedback, announcements, course content. |
| When does it sync? | **Three triggers:** a manual Sync button in the extension popup; a quiet sync whenever I open a Blackboard tab (throttled to once per 30 min); a **daily background pull** (`chrome.alarms`). |
| Session expired? | **Extension badge only.** A red `!` on the icon. Clicking it opens Blackboard, and it syncs automatically after login. No Chrome notifications. |
| Where do assignments live? | **Their own tables (`bb_*`)**, not `tasks` / `education_tasks`, so the known Education split is left alone. |
| Course content → lecture prep | **Module library + suggestions.** All content is listed per module workspace. Session prep shows "Suggested from Blackboard" items I tick to attach. Nothing is auto-attached. |
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

- **`manifest.json`**: MV3; `host_permissions`: `https://blackboard.durham.ac.uk/*` and the dashboard origin; `permissions`: `alarms`, `storage`. No `tabs`/`cookies`/`webRequest` permissions are needed.
- **Service worker**
  - `sync()` runs: `users/me` → memberships (current term only) → per course: gradebook columns, my grades, announcements, content tree (depth-limited, e.g. 4 levels) → To Do feed in 14-day windows from −14 to +84 days. Courses are fetched sequentially with a small delay. It's one user, so there's no reason to hammer the API.
  - Builds one normalised payload (`BbSyncPayload`, shared type in `lib/blackboard/types.ts`) and `POST`s it to `/api/blackboard/sync`.
  - **Auth check:** a 401/403, or a redirect to the SSO host from `users/me`, means the session has expired. It sets badge `!` (red), stores `needsLogin = true`, and stops.
  - Triggers: popup button; `chrome.alarms` daily (e.g. 08:00 local); `tabs.onUpdated` for Blackboard URLs (needs no extra permission with host access), throttled to once per 30 min. When `needsLogin` is set, the next successful Blackboard page load clears it and syncs.
- **Popup**: last synced time, counts, **Sync now**, and an options field for the dashboard URL + sync token (`chrome.storage.local`).
- **Verify in phase 1:** whether service-worker fetches carry the Blackboard cookie (they should with host permissions; SameSite rules for extension requests). Fallback: run the fetch from a content script inside an open Blackboard tab.
- **Expect frequent badge prompts:** Durham sessions expire after hours of idling, so the daily background pull will often find the session gone. The on-visit sync is what will usually keep data fresh.

---

## 5. Data model

All tables: `user_id default auth.uid()`, four own-row RLS policies, `revoke … from anon`, `grant … to authenticated`. Re-runnable migration, applied by hand. Upsert keyed on `(user_id, bb_id)`. **Never hard-delete:** rows that vanish from Blackboard get `removed_at`. Each row keeps `first_seen_at` / `last_seen_at`.

| table | key columns |
|---|---|
| `bb_courses` | `bb_id`, `course_code` (`GEOG1241_2026`), `module_code` (`GEOG1241`), `name`, `term`, `workspace_id` (nullable, auto-matched on `workspaces.module_code`, manual override), `week_offset int default 0`, `url` |
| `bb_assignments` | `bb_id` (To Do item / column id), `course_id`, `title`, `due_at timestamptz`, `bb_content_id`, `status` (`not_submitted` / `submitted` / `graded`, from Blackboard), `url` |
| `bb_grades` | `bb_column_id`, `course_id`, `assignment_id` nullable, `score`, `possible`, `display_grade`, `feedback` (plain text), `released_at` |
| `bb_announcements` | `bb_id`, `course_id`, `title`, `body_text` (HTML stripped server-side), `posted_at`, `url`, `read_at` (dashboard-side only) |
| `bb_content` | `bb_id`, `course_id`, `parent_bb_id`, `title`, `kind` (`folder` / `document` / `link` / `file` / `assignment` / …), `available_from`, `path` (breadcrumb of folder titles), `week_label int` (parsed from the title, e.g. "Week 5"), `url` |
| `bb_sync_runs` | `started_at`, `finished_at`, `trigger` (`manual` / `visit` / `daily`), `ok`, `counts jsonb`, `error`. Append-only, used for "last synced" |

**Week mapping.** University week = `week_label + bb_courses.week_offset`. Matching a content item to a timetable session tries, in order:
1. `available_from` falls in the session's week (date-based, no labels needed);
2. the mapped university week equals the session's week.

Matches are only *suggestions* in session prep. Ticking one creates the usual `workspace_links` row with `session_uid`, so the existing prep traffic light is unchanged until I act.

Dates are stored as UTC and shown as Europe/London days (`lib/google/london-day.ts`). Pure normalisers (`lib/blackboard/normalise.ts`: code parsing, week-label parsing, HTML stripping, To Do → assignment mapping) get `normalise.test.ts`.

---

## 6. API

| route | |
|---|---|
| `POST /api/blackboard/sync` | Body `BbSyncPayload`. Validates (zod), upserts everything in one RPC/transaction, marks missing rows `removed_at` **only for courses included in this payload**, writes a `bb_sync_runs` row. Returns counts |

**Auth:** `lib/blackboard/auth.ts`, the same shape as `lib/timer/auth.ts`. The extension sends `Authorization: Bearer $BLACKBOARD_SYNC_TOKEN`, acts as the owner user id, and uses the service-role client. The token is accepted only on `/api/blackboard/*` and `/api/mcp`. Add `/api/blackboard` to `PUBLIC_PATHS` in `proxy.ts`. Add the env var names to `.env.example`. A separate token from `TIMER_API_TOKEN`, so leaking one doesn't open the other.

No AI in the sync path.

---

## 7. Dashboard UI

- **Lectures → Assignments tab** (replaces the placeholder in `LecturesBoard.tsx`): the same Upcoming · Past due · Completed · History tabs and module filter as Lectures. Each row shows module, title, due date, Blackboard status, grade when released, and **Open in Blackboard**.
- **Workspace (module) page**: a "Blackboard" section with announcements (unread first) and the content library as a collapsible folder tree, labelled in university-week numbering.
- **Session prep**: a "Suggested from Blackboard" list (§5).
- Follows `DESIGN.md` and shared components (`FilterTabs`, `DataTable*`, `StatusBadge`, `MetadataChip`).

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

### Phase 1 result (9 Nov 2026)

`lib/blackboard/client.ts` ran live in a logged-in tab: **all 10 current courses, 551 content items (max folder depth 3, none skipped), 20 announcements, 12 gradebook columns, 8 released grades, 2 To Do items, 0 errors, 318 requests in 106 s.** Five courses are org courses (`X_*`) with no module code. Still to confirm once the extension is loaded unpacked: whether the **service worker's** own fetches carry the cookie (the popup reports `via the background worker` or `via the open Blackboard tab`).

---

## 10. Phases

| phase | scope | done when |
|---|---|---|
| **1. Extension spike** ✅ built | Bare extension: Sync button → fetch every endpoint in §3 → store + summarise the payload (Download JSON). Worker fetch with open-tab fallback; badge on login loss | a full payload for all 10 current courses from one click; 401 handling sets the badge |
| **2. Schema + sync API** | migration (not applied), `lib/blackboard/*` normalisers + tests, `/api/blackboard/sync`, token auth, proxy entry | the extension's payload lands in Supabase; re-sync is idempotent; vanished items get `removed_at` |
| **3. Assignments tab** | real Assignments tab | coursework shows with correct London due dates and tabs |
| **4. Content + announcements** | module Blackboard section, week offset setting, prep suggestions | a week's readings appear as suggestions on the right sessions |
| **5. MCP** | `/api/mcp` tools in §8 | Claude can answer "what's due this week?" from the synced data |
| **6. Triggers polish** | daily alarm, on-visit sync, badge flow | badge appears when logged out; syncs itself after login |

Each phase is its own Claude Code session.

---

## 11. Open questions

**Not planned unless asked for** (ideas only; nothing is built for them):
- "Plan this": copy an assignment into `education_tasks` for Daily Goals / time-blocking.
- "Mark as done" for coursework with no Blackboard submission.
- Due dates as pills on the calendar.
- A "last synced" banner on the dashboard (the extension badge already covers logging in).
- An AI summary of announcements.

Questions:

- Is the week offset the same for every module in a term, or does it vary by module? (The schema supports per-course; the UI could default to one term-wide value.)
- Durham's IT acceptable-use policy: reading my own data with my own session at a gentle rate should be fine, but check that it doesn't forbid automated access.
- Once phase 1 shows the To Do item shape: does it cover Turnitin/external-tool coursework, and does it carry submission status?
