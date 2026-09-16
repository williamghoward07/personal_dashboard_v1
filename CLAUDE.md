# Study Copilot

Personal, single-user dashboard for daily use as a university Geography student.
Not a demo project — built for my own real use. Bento-grid layout, no module
(academic/finance/fitness) visually dominates another. Central AI query box
connects across modules.

**Before writing Next.js code, read `AGENTS.md`**: this is Next.js 16 (App
Router) with breaking changes — check `node_modules/next/dist/docs/` rather
than relying on memory (e.g. `searchParams` is a Promise in pages).

## Design philosophy
- Equally weighted, self-contained widget cards in a bento-grid (they don't
  need identical sizes, just balanced visual weight)
- Desktop/web-first, designed for 1440px+ screens (current priority)
- Mobile companion app is a future phase — explicitly out of scope now
- Research prompts library is standalone, not nested under academics
- Notion-style tailored views per task (e.g. clicking an essay shows a
  bespoke checklist for that task, not a generic template)
- Visual design system: "BIO-SYSTEM" dark cyber-kinetic theme (committed
  dark-only, not light/dark-adaptive). Deep charcoal/green surface scale,
  Bricolage Grotesque for headings, Instrument Sans for body text, IBM
  Plex Mono for data/tabular displays, glassy bento cards with a
  hover glow in the active module's accent color. Per-module accent colors
  (`lib/theme.ts` `MODULE_ACCENT`): mint = Health, electric blue = Money,
  orange = Education (and the home query box), pink = Research, purple =
  Habits/Todos, amber = People, crimson = Bible, teal = Workspaces (default —
  each workspace/folder can pick its own). Tokens live in `app/globals.css`
  (`@theme`) and `lib/theme.ts` (accent → class maps). Icons stay on
  `lucide-react` (not the reference mockups' Material Symbols) to avoid a
  second icon system — reskin new UI to match this rather than reverting to
  the old neutral light/dark styling.
- Glass effects: prefer an existing component library over hand-rolled
  CSS (e.g. glinui — Radix + Tailwind, ships elevation/blur/motion
  tokens) so widgets consume shared tokens rather than each inventing
  the effect. Some glass/refraction effects render Chromium-only —
  verify Safari before relying on one for a shipped widget, since an
  iOS app is a planned future phase.
- Shared building blocks — reuse, don't re-invent: `<ProgressRing />`
  (`components/ui`), `LoadingGlowBorder` (the LED-strip loading border on
  every AI/search input), `LiquidSwitch` (segmented toggle), `Popover` and
  `InfoPopover` (in-place, not portalled — so per-workspace CSS variables
  still apply), `Modal` (portalled), `ConfirmDialog`, `AccentPicker`,
  `onActivateKey` (`lib/utils/a11y.ts` — Enter/Space on a clickable row
  only when the row itself has focus, never from an input inside it),
  `useStoredIdSet` (per-browser remembered id sets, e.g. collapsed folders).

## Tech stack
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Backend/Auth/DB: Supabase (RLS on every table)
- Deployment: Vercel
- Tests: vitest + jsdom + Testing Library (`npm test`); pure logic lives in
  `lib/**` with a `.test.ts` next to it
- Drag and drop: `@dnd-kit` (grip-handle pattern — see `HabitCard`)
- AI: Gemini (aistudio.google.com), behind a swappable interface in
  `lib/ai/gemini.ts` — every AI call site imports only from there, so a
  provider switch only touches that one file. Two tiers (`fast`/`smart`),
  every call logged to `ai_usage`, daily cap of 200 calls
  (`lib/ai/constants.ts` — call-count based, not cost based, and it fails
  open if the usage read errors). Powers the home query box (Find / Ask /
  Capture), the Brain Dump page and the People quick-add bar.

## Pages (sidebar order, `lib/nav-items.ts`)
Home · Calendar · Education · Workspaces · Money · Research · Tasks
(`/habits` and `/todos`, one tabbed board) · People · Bible · Brain Dump ·
App Library (`/apps`). Also `/ai-usage`. `/health` exists but is hidden
(`notFound()`, 2026-09-01 — Bevel already covers it; a one-line revert).

## Home page (`app/page.tsx`)
The **System Query** box on top, then the bento grid: Daily Goals, Morning
routine, Education, Workspaces, Money, AI usage, Research, Habits, People,
App Library (pinned links), Calendar.

A home density/layout overhaul is **deferred** until it's clearer which
widgets actually get used. Don't add home widgets casually.

- **System Query** (`app/components/AiQueryBar.tsx`) — one input with four
  explicit modes (`LiquidSwitch`, one-line hint under the box explaining the
  current mode; logic in `lib/search/query-mode.ts`):
  - **Find** — Gemini extracts keywords + modules only; the queries
    themselves are hand-written `ilike` lookups (`app/api/search`). No AI in
    query execution.
  - **Ask** — Find, then a smart-tier call answers from those results only.
  - **Capture** — same extractor as Brain Dump (`/api/brain-dump/extract`,
    smart tier with thinking, so pricier). Produces drafts; **nothing is
    written until the user confirms** each draft (or "Confirm all" for
    todos / education tasks / calendar events). People drafts always open
    their form for review. Writes go through `/api/capture/confirm`.
  - **Auto** (default) — local, zero-cost routing: ends in "?" → Ask;
    multi-line / ";" / reads as an instruction (add, remind me, book, met…,
    or has a date/time hint) → Capture; question word → Ask; else Find.
  - The input is an auto-growing textarea (Enter submits, Shift+Enter adds a
    line). Draft lists live in module-scope stores (`lib/braindump/store.ts`
    `createDraftStore`) so an extraction survives navigating away; the home
    box and Brain Dump have separate stores. Shared UI:
    `app/components/capture/DraftList.tsx` / `DraftCard.tsx` (drafts are
    editable inline before confirming).
- **Daily Goals** — top: roll-up ring for TODAY across todos +
  `education_tasks` + habits, with "5/8 today". Bottom: checklist of general
  todos only — starred first, then overdue, then due today; starred undated
  todos always show. **Capped at 5 open rows** (`capChecklist`) with a
  "✓ N done · +M more →" link to `/todos`; rows ticked or added this visit
  stay in place. Rows show a star toggle and the todo's workspace chip. Pulls
  from Microsoft To Do at most every 5 minutes.
- **Morning routine** — see Habits below. Offers a one-time setup; "Not now"
  hides the offer in that browser.
- **Education / Research / Habits / People / Money / AI usage / App Library
  / Calendar** — small glance cards linking to their pages. Calendar shows
  "nothing on today" (or today's items), a divider, then the next event. On
  the full calendar page, clicking an event opens an anchored popover
  (desktop) or bottom sheet (mobile) — never a full-screen blocking modal.
- **Workspaces** — up to 4 active workspaces, most recently opened first,
  with colour, folder, open-action count and "opened X ago".

## Modules

### Todos (`/todos`, `todos` + `todo_lists`)
- Lists (colour chips), one level of subtasks, due date + time, List /
  Extended / Completed views, a **Starred** filter (starred sort first).
- A todo filed under a workspace (`todos.workspace_id`) shows that
  workspace's coloured chip everywhere (Todos rows, detail view, Daily
  Goals). Workspace todos are ordinary todos — they appear in `/todos` and
  Daily Goals like any other.
- **Microsoft To Do sync** (replaced Apple Reminders): pull on `/todos` load
  (`/api/microsoft/todo/pull`), push on every change to a linked todo
  (`/api/microsoft/todo/push`): tick, star (= To Do "Important"), title,
  notes, due date, delete (deletes the task first; if that fails the todo is
  kept). To Do lists map to app lists by name (the default "Tasks" list =
  no list; missing lists are created). A reminder time becomes `due_time`.
  Tasks deleted in To Do are deleted here. Completed tasks older than 30
  days aren't imported. Todos created in the app stay app-only (never
  created in To Do); To Do-linked todos can't have app subtasks (DB
  trigger). A status line on `/todos` shows synced / Connect / Reconnect.
  One Microsoft connection (`integrations` provider `microsoft_onenote`,
  scopes Notes.Read + Tasks.ReadWrite) serves OneNote and To Do.
- **Why not Apple Reminders:** iCloud CalDAV only serves placeholder
  "⚠️" lists for upgraded Reminders (tsdav also defaulted to a VEVENT
  filter), so the old CalDAV pull never imported anything. The CalDAV code
  was removed; `todos.caldav_uid` / `upsert_caldav_todos` remain unused.

### Education (`/education`)
- `years` → `modules` → `topics` / `tasks` (coursework, per module), with
  time tracking (`time_logs`) and research links attached to tasks
  (`task_research_links` → `perplexity_links`). These base tables exist only
  in the live DB (no migration file — `remote_schema.sql` is empty).
- OneNote: link a module to a section and open its pages in OneNote
  (read-only, fetched on demand, never indexed). Notes documents can carry
  todos with a progress bar (`notes_documents`) — **its migration
  (`20260826000000_notes_documents.sql`) has not been applied to the live
  DB**, so that feature currently shows 0 linked todos.
- **Known split:** the Education pages use `tasks` (per module); Daily
  Goals, the time-block wizard and Capture use `education_tasks`. So a
  deadline added in Education doesn't count on Daily Goals, and a captured
  education task doesn't show in Education. Reconciling them (probably
  pointing everything at `tasks`, with a module picker on capture) is open.

### Workspaces (`/workspaces`, `/workspaces/[id]`)
A workspace is the desk for one piece of work: sources (links with
kind/citation/DOI), scoped next actions (ordinary todos with
`workspace_id`), and an append-only thinking log (kinds + custom
`#tags`). Plus sessions ("last opened"), stat rings, archive, and a
Markdown export (always complete, even for hidden sections).
- **Folders** (`workspace_folders`, nested via `parent_id`): breadcrumb,
  drag a workspace/folder (grip handle) onto a folder or crumb, `?folder=`
  in the URL. DB triggers block cycles and move a deleted folder's contents
  up a level.
- **Colour**: workspace `color` → nearest folder ancestor with a colour →
  teal (`resolveAccent`). Implemented as a `--ws-accent` CSS variable and the
  `ws-accent` Tailwind token, so components don't thread colour props.
- **Layout**: `hidden_sections` (Layout menu — stats / sources / actions /
  log; hidden = not rendered, data untouched, the rest of the page adapts)
  and `collapsed_sections` (chevron → slim bar).
- **Launch set** opens every source in a tab; browsers block all but the
  first unless pop-ups are allowed, so it reports blocked tabs, explains how
  to allow them, and offers "Open next".
- An (i) help popover on both pages explains all of this
  (`WorkspacesHelp.tsx`) — keep it in sync when behaviour changes.
- Logic: `lib/workspaces/{folders,layout,tags,launch,glance,stats}.ts`.

### Habits (`/habits`, `daily_goal_habits` + `daily_goal_habit_completions`)
- One shared table for all habits, distinguished by `widget` (`habits` |
  `health`) and `frequency_type` (`daily` | `specific_days` |
  `times_per_week`). Completions are separate dated rows (unique per habit
  + day), never a boolean — needed for weekly counts, streaks and "already
  met this week". Quantifiable habits store a `value` against a target.
- **Habit steps** (`habit_steps`, `habit_step_checks`): any non-quantifiable
  habit can have ordered **core** and **bonus** steps (edit the habit).
  Ticking every core step for a day logs that day's completion via RPC
  `set_habit_step_check`; unticking a core step removes it; bonus steps
  never matter. With no step flagged core, all count.
- **Morning routine** = a `times_per_week` habit with steps (default target
  4/week, 1–3 core steps). Home card: core checkboxes, collapsed bonus, week
  dots + status ("on track" / "every day counts"), a "don't miss twice"
  nudge only after two missed scheduled days in a row, and after 11:00 a
  "minimum version: just <first step>" line. It fires `habits:changed`
  (`lib/habits/events.ts`) so Daily Goals and the Habits card refresh.
  Logic in `lib/habits/steps.ts`.
- Habit steps are **not** Calendar routines (`routines`, `routine_items`,
  `routine_instances`): those are timed stacks dragged onto the calendar to
  create Google events, with no "done" tracking.
- All dates are Europe/London calendar days (`lib/google/london-day.ts`).
- Old `habits` / `habit_logs` / `rugby_sessions` tables are legacy and
  unused.

### People (`/people`)
- Contacts, interactions (+ attendees), places, follow-ups, Google Contacts
  sync (two-way for linked contacts), and the Gemini quick-add bar.
- **Instagram follows** (`instagram_follows`): no Instagram API and no
  scraping or browser automation (against Instagram's terms). Workflow:
  request Instagram's "Download your information" export, unzip it, paste
  or upload `following.json` → `/api/instagram/import` parses
  `relationships_following` and upserts by handle, using the export's own
  timestamp as `followed_at`. Re-importing is additive-only: a handle
  already stored is never touched (its `note`/`display_name`/`person_id`
  are preserved), so re-running the same or a newer export is always safe.
  Follows can be linked to a `people` row. Logic: `lib/instagram/follows.ts`.

### App Library (`/apps`, `link_folders` + `quick_links`)
- All folders open by default (collapse state remembered per browser),
  Expand/Collapse all. Folder toolbar: **+** (add a link straight into that
  folder), drag handle, edit, delete; the virtual "Unfiled" folder only has
  +. Folders and links reorder by drag and drop, and links can be dragged
  between folders. `quick_links.sort_order` is global (the home launcher
  sorts pinned links by it), so moves renumber all links in display order
  (`lib/app-launcher/order.ts`). `link_folders.color` can't be teal.

### Money (`/money`)
- Starling (live balances + Spaces, transaction sync) and PDF bank-statement
  import (generic parser, mandatory review step). Trading212 was tried and
  removed; Monzo isn't built.

### Bible (`/bible`)
- Standalone module, no home widget. Keyed off `bible_passages` (a
  normalised book/chapter/verse reference — never scripture text, never a
  Bible API). One `status = 'active'` study at a time (partial unique
  index); studies are paste-JSON imports (`import_bible_study`), with
  per-question `answered_at` for pause/resume. Zero AI calls — the prompt
  launcher only builds a copyable prompt for a separate Claude Project.

### Research (`/research`)
- Prompt library (`prompts`) and saved Perplexity chats (`perplexity_links`
  — manual link saving, no public API). The home card shows counts.

### Brain Dump (`/brain-dump`)
- Long free-text → drafts (todos, education tasks, calendar events, new or
  updated people, logged conversations), reviewed with the same shared
  draft list as Capture.

## Data model conventions
- `todos` — general to-dos only, separate from education tasks.
- `tasks` / `education_tasks` — see the known split under Education.
- `habits` model — see Habits (completions as dated rows; steps separate).
- `ai_usage` — append-only, one row per `generateStructured()` call (token
  counts, tier, model, estimated USD). Feature keys: `search`,
  `search_answer`, `brain_dump` (Capture + Brain Dump), `people_quick_add`,
  and the retired `search_act` (kept for old rows).
- Every table: `user_id default auth.uid()`, four "own row" RLS policies,
  `revoke … from anon`. Child tables also check the parent row's owner in
  RLS. RPCs are `security invoker` with `set search_path = ''` unless they
  must be definer (then they pin `auth.uid()` themselves).
- **Migrations are applied by hand** (Supabase SQL editor or the Supabase
  connector), not CLI-pushed, so the files and the live DB can drift.
  Write them re-runnable (`if not exists`, `drop policy if exists`, guarded
  constraints, `create or replace`). Two older files share a timestamp.

## Environment Variables
Required in `.env.local` (see `.env.example` for setup notes). Never commit
actual values.

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
- **Google (Contacts, Calendar)**: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY` (seals refresh
  tokens). The Google OAuth app is in "Testing" mode, so refresh tokens
  expire after 7 days — publishing the consent screen fixes the weekly
  re-auth.
- **Microsoft (OneNote + To Do)**: `MICROSOFT_CLIENT_ID`,
  `MICROSOFT_CLIENT_SECRET` (Azure app registration, "Personal Microsoft
  accounts only", delegated Notes.Read + Tasks.ReadWrite + offline_access
  + openid + profile; reuses `INTEGRATION_ENCRYPTION_KEY`). Connect via
  `/api/microsoft/connect?next=/todos` (or from Education). Adding a scope
  needs one reconnect.
- **Starling**: `STARLING_ACCESS_TOKEN`
- **Gemini**: `GEMINI_API_KEY` (aistudio.google.com, free tier), optional
  `AI_ENABLED=false` kill switch
- **Claude Project deep link** (optional, hidden when unset — the app never
  calls Claude): `NEXT_PUBLIC_BIBLE_CLAUDE_PROJECT_URL`
- `ICLOUD_CALDAV_*` are no longer used.

## Using Education and Workspaces together
- **Education** is the official record: year → module, assessed deadlines,
  grades, time logged, OneNote.
- **Workspaces** is where the work happens: sources, next actions, thinking
  log.
- For an essay: add the deadline in Education **and** create a workspace
  (subtitle = module), filed under a folder like Uni › Year 2. Non-uni
  projects (e.g. the Christian clothing brand) are workspace-only — hide the
  sections they don't need.
- If one side goes unopened for a few weeks, revisit whether both are
  needed.

## Obsidian (guidance only — nothing built)
- Obsidian itself is free. Keeping the vault in iCloud Drive syncs Mac ↔
  iPhone for free (Obsidian Sync is the paid alternative).
- Using the Claude subscription with it: point a filesystem MCP server in
  Claude Desktop at the vault folder, or run Claude Code inside the vault.
  The Claude phone app can't read local files.
- Possible future link: export a workspace's Markdown straight into the
  vault.

## Decided / out of scope for v1
- No push/email notifications — in-app only, not building for mobile yet
- Data export: Supabase's own export, plus per-workspace Markdown export
- Perplexity: manual link saving only (no public API)
- Instagram: screenshots → Claude → paste only; never automate Instagram
- Microsoft To Do is the phone-side todo app (not Apple Reminders)

## Bugs (bounded, fix first)
- Money: hidden accounts are not actually hidden — the toggle saves
  `is_hidden`, but nothing filters on it (and the headline balance still
  includes them).
- Calendar routines: clicking a routine causes the panel to jump far up the
  page while the mouse hovers the tab; it snaps back to the correct centred
  position only when the window loses focus. (Reported; not re-verified.)

## Backlog
- **Money**: shrink "Add account", "Hidden accounts" and "Import PDF
  statement" (too dominant); per-category spending breakdown with
  drill-down to transactions; a monthly income breakdown by sender; move a
  transaction to another (or a new) category, and persistent
  sender → category rules.
- **Todos**: multi-select and move to another/new list; "add a reminder"
  wording in capture.
- **Education**: reconcile `tasks` / `education_tasks`; a dedicated research
  panel with saved conversation links.
- **Calendar**: the basic Google Calendar event options when adding an event
  (all-day vs timed, etc.).
- **Home**: edit mode (drag widgets to chosen positions, saved per user),
  after the density overhaul decision; a whole-app UI pass using the
  Perplexity home screen as the visual reference; a widget for Claude
  session/weekly usage (no source for that data identified yet).
- **Platform**: web push notifications to the phone (PWA). Approach
  undecided.

## Reference docs
- `docs/FEATURE_INVENTORY.md` — what's built, half-built and hidden.
- `docs/people-crm-plan.md` — the People module's original plan.
