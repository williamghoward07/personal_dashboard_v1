# Focus Timer — feature spec

An Opal-style start/stop timer for Study Copilot. Hit start when you sit down to work on something, hit stop when you're done, and the session is logged against that workspace so it shows when you've worked on it. The existing **manual "add time" button stays exactly as it is** — the timer is a second way to create the same kind of log entry, not a replacement.

---

## 1. Core design decision: the timer lives on the server, not on the Mac

A running timer is just a row in Supabase with `started_at` set and `ended_at` still `null`. Every client — the web dashboard, a Mac menu bar item, a keyboard shortcut, your phone — only ever sends *start* / *pause* / *resume* / *stop* and displays elapsed time computed from the stored timestamps.

Why this matters:

- **Nothing to lose.** Closing the lid, a browser crash or a restart can't kill the timer, because no client is "holding" it.
- **Works across machines.** Start on the Windows PC, stop on the MacBook. One source of truth.
- **The Mac part becomes thin.** The menu bar / shortcut layer is a remote control for an API, not a timer app in its own right.
- **Server time only.** Durations are always computed from database `now()`, never a client's clock.

---

## 2. Decisions (answered)

| question | decision |
|---|---|
| What can a session be logged against? | **Any workspace.** Sessions attach to a workspace so they appear in that workspace's history ("when I worked on this"). Claude Code to confirm which table/entity the app calls workspaces. A label/note is optional. |
| Pause/resume? | **Yes, in v1.** |
| Long-running timers | **4 h check-in:** if a session has been running for more than 4 hours, show an "Are you still working?" popup the next time the dashboard is opened. The popup does **not** stop the timer. **12 h hard stop:** sessions are automatically stopped at 12 hours of elapsed time. |
| Timer vs manual time | **One combined total everywhere by default.** A hidden/collapsed breakdown shows timer time and manual time separately, plus a **donut chart** with one colour per source and the combined total as a number in the centre. |

---

## 3. Data model

### Inspect first
Before writing anything, Claude Code must:

1. Find the table the manual "add time" button writes to and how it links to a workspace.
2. Find the workspaces table.
3. Check the pending `modules_links_link` migration before creating anything that links sessions to workspaces.
4. Report back and recommend route A or B below.

The goal is that **timer sessions and manual entries can be summed together and also split by source.**

- **A. Extend the existing manual-entry table** with additive, nullable columns only (`source`, `started_at`, `ended_at`, …). Existing rows and the manual button's behaviour must be completely unaffected (existing rows default to `source = 'manual'`).
- **B. New `time_sessions` table** plus a view that unions it with manual entries, exposing a `source` column (`timer` / `manual`) for the breakdown.

### Proposed `time_sessions` (if route B)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `session_group_id` | uuid | groups the segments of one paused/resumed session |
| `workspace_id` | uuid fk | the workspace the time is logged against |
| `label` | text null | optional, e.g. "Hydrology reading" |
| `started_at` | timestamptz not null | server `now()` |
| `ended_at` | timestamptz null | null = this segment is running |
| `client` | text | `web` / `mac` / `shortcut` / `phone` — which device started it |
| `ended_reason` | text null | `stopped` / `paused` / `trimmed` / `auto_stopped_12h` / `discarded` |
| `note` | text null | added on stop |
| `created_at` | timestamptz | |

Rules:

- **Only one running segment at a time** — partial unique index on rows where `ended_at is null`.
- **Pause = segments, not a flag.** Pausing ends the current row with `ended_reason = 'paused'`; resuming starts a new row with the same `session_group_id` and `workspace_id`. A session's duration is the sum of its segments. Keeps to the "dated rows, never booleans" convention.
- **A session is "paused"** when its latest segment ended with `paused` and no later segment exists. Only one session (running *or* paused) may be open at a time.
- **Never store per-day splits.** Store UTC timestamps; bucket into days in Europe/London at query time. A session crossing midnight is split in the query, not in the table. (Clocks go back on Sunday 25 October 2026 — a good first test.)
- **Nothing hard-deletes.** "Discard" sets `ended_reason = 'discarded'` and excludes it from totals.
- Migration file written by Claude Code, **applied manually by Will**.

---

## 4. Long-running timer behaviour

**4-hour check-in (soft)**
- When the dashboard loads and the open session's running time exceeds 4 h, show a modal: *"Your timer for [workspace] has been running for 4 h 37 m. Are you still working?"*
- Actions: **Keep going** (dismiss; don't ask again for this session until the next 4 h mark), **Stop now**, **Stop and trim** (set the real end time, e.g. "I stopped at 14:30").
- Never stops the timer on its own.
- Track the last acknowledged check-in on the session (e.g. `checkin_acknowledged_at`) so it doesn't nag on every page load.

**12-hour hard stop**
- Any segment running for 12 h is stopped with `ended_at = started_at + 12 h` and `ended_reason = 'auto_stopped_12h'`.
- Enforced two ways so it works even if no one opens the app: (1) a Vercel cron (e.g. hourly) that stops anything over 12 h; (2) the `active` API checks and applies it on read.
- Next time the dashboard is opened, show a one-off notice: *"Your [workspace] timer was stopped automatically after 12 hours"* with a **Trim** option to correct the end time.
- Pause time does not count towards the 12 h — it's 12 h of *running* time.

---

## 5. API (Next.js route handlers)

| route | does |
|---|---|
| `GET /api/timer/active` | open session (running or paused), elapsed running seconds, whether a 4 h check-in is due, and today's combined total for that workspace. Applies the 12 h stop if due. |
| `POST /api/timer/start` | `{ workspace_id, label? }` → if a session is already open, return `409` with it so the client can offer "switch" |
| `POST /api/timer/pause` | ends the running segment |
| `POST /api/timer/resume` | starts a new segment in the same session |
| `POST /api/timer/stop` | `{ trim_to?, note? }` — `trim_to` lets you say "I actually stopped 20 minutes ago" |
| `POST /api/timer/switch` | atomic stop-current + start-new on another workspace |
| `POST /api/timer/discard` | soft-discard the open session |
| `POST /api/timer/checkin` | acknowledge the 4 h check-in ("keep going") |
| `GET /api/timer/recent-workspaces` | last ~8 distinct workspaces timed, for quick pickers |
| `GET /api/time/breakdown` | `{ workspace_id?, from, to }` → `{ total, timer, manual }` in seconds, for the breakdown panel and donut |

**Auth:** web uses the normal app session. Non-browser clients (Mac menu bar, Shortcuts, phone) send a personal bearer token stored as `TIMER_API_TOKEN` in env. The token is accepted **only** on `/api/timer/*` routes. Add the variable name to `.env.example` and CLAUDE.md.

---

## 6. Clients

### 6a. Web dashboard
- **Persistent timer pill** in the app shell: workspace name, elapsed time (IBM Plex Mono, tabular figures), pause/resume, stop. Shows a "paused" state. Visible on every page while a session is open.
- **Start points:** a "Start timer" button next to (not replacing) the manual add button on each workspace page; a quick picker of recent workspaces from the pill/home page.
- **Stop sheet:** shows duration, lets you trim the end time, add a note, or discard.
- **4 h / 12 h modals** as described in §4.
- **Time totals:** everywhere time is shown, show the **combined** figure (timer + manual).
- **Hidden breakdown:** a collapsed "Breakdown" disclosure (closed by default) beneath each total. When opened it shows:
  - Timer time and manual time as separate figures.
  - A **donut chart** with two segments — one colour for timer, one for manual — and the **combined total as a number in the centre**.
- **Redesign gate:** build this as plain semantic HTML first (the donut can be a simple SVG); styling waits until the nine-prompt UI redesign is finished.

### 6b. MacBook — cheapest first
1. **Apple Shortcuts** — "Start focus", "Pause/resume focus" and "Stop focus" shortcuts that call the API with the bearer token, bound to keyboard shortcuts. The same shortcuts work from Siri and the iPhone. A shortcut can also switch on a macOS Focus mode at the same time, giving Opal-style notification silencing for free.
2. **Menu bar item** via a lightweight menu bar plugin tool (e.g. SwiftBar/xbar running a small shell script, or a Raycast extension): shows `● Hydrology 42:10` (or `❚❚` when paused) in the menu bar; dropdown to pause/resume, stop, or switch to a recent workspace.
3. **Native SwiftUI menu bar app** — only if 1–2 feel limiting.

Recommendation: do 1 and 2. Because the timer is server-side, the Windows PC just uses the web pill.

---

## 7. Opal-style extras (phase 4 — pick and choose later)

- **Focus mode on start** — Shortcut turns on a macOS Focus to mute notifications; turns it off on stop.
- **Idle detection** — the Mac client checks system idle time; when you come back after N minutes away, it asks "You were away 25 min — keep or trim?"
- **Planned length** — optional "25 min" target that notifies when reached but doesn't auto-stop.
- **Habit link** — a session of ≥ N minutes in a linked workspace creates a `habit_completions` row.
- **Stats** — today/week totals per workspace, streaks, a calendar heatmap, planned vs actual.
- **Stretch: frontmost-app tracking** — the Mac client samples which app is in front during a session, stored only as a summary, to give a rough focus score.

---

## 8. Edge cases to handle

- Start while one is open (running or paused) → offer **switch**, never silently run two.
- Two devices open → server state wins; clients refetch on window focus and poll `active` every ~30 s.
- Lid closed / sleep → server timestamps are unaffected; the 4 h check-in and 12 h stop handle "forgot to stop".
- Manual entry overlapping a timer session → warn, don't block.
- GMT/BST changeover and sessions crossing midnight → handled by query-time bucketing.
- Trim must never set an end time before the segment's start or after now.

---

## 9. Phases

| phase | scope | done when |
|---|---|---|
| **1. Schema + API** | migration file (not applied), all route handlers incl. pause/resume, 4 h check-in flag, 12 h stop (cron + on-read), breakdown endpoint, token auth. No UI. | every endpoint works via `curl`; only one open session possible; pause/resume sums correctly; 12 h stop and 4 h flag verified with backdated test rows; manual button untouched |
| **2. Web timer** | shell pill, start buttons, stop sheet, 4 h / 12 h modals, combined totals + hidden breakdown with donut — plain HTML | full session (with a pause) run from the browser on both machines; totals show combined; breakdown + donut correct |
| **3. Mac** | Shortcuts + menu bar plugin | start/pause/stop from a keyboard shortcut and the menu bar without opening the dashboard |
| **4. Extras** | chosen items from §7 | per item |

Each phase is its own Claude Code session.
