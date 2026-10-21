# Feature Inventory — Study Copilot / Personal Dashboard

*Snapshot: 2026-09-01. Purpose: a plain-language map of everything that's
built, so I can decide what this "second brain" should actually be.
Take this into the Claude Project and brain-dump against it.*

---

## What it is today

A personal, single-user web dashboard (Next.js 16 + Supabase + Gemini,
deployed on Vercel). Bento-grid home screen, one module per life area,
a central AI query box. Dark-only "BIO-SYSTEM" theme. Google sign-in
only. Everything is behind login; every table is owner-scoped.

**Honest status:** the bones are ~80% there and more is working than it
feels like. What's missing is the thing that would make me *use* it —
it's laptop-only, has no offline mode, and capture is slow (open laptop
→ find module → open form → fill fields → save).

Status legend: ✅ works · ⚠️ works but rough · 🐛 known bug · 🚧 half-built ·
❌ not built · 👻 built but hidden

---

## Modules

### Home (`/`)
- ✅ Bento grid of 8 glance cards (Daily Goals, Education, Money, AI Usage,
  Research, Habits, People, Calendar). Each is live data, each links into
  its module.
- ✅/🐛 **AI query bar** — three modes, all built, but auto-detected with no
  visible selector or explanation (this is the confusing part):
  - **Find** — type a query, Gemini extracts keywords + which modules to
    search, then a plain text search runs (no AI in the actual lookup).
  - **Answer** — for question-shaped queries, an extra Gemini call
    summarises the results.
  - **Act** — "add a todo to email my tutor" → Gemini drafts it → I
    confirm → it's created (todo, education task, or calendar event).
- ✅/🐛 **Daily Goals card** — a ring ("5/8 today") over education tasks +
  follow-ups + habits, plus a general-todo checklist with inline add.
  Bug: the ring counts a table (`education_tasks`) that the Education
  module doesn't write to, so coursework deadlines never show here.
- ❌ Planned but not built: a quick-copy Prompt Library card; the People
  quick-add bar on the home screen (it's on `/people` instead); home-screen
  edit mode (drag widgets).

### Education (`/education`)
- ✅ Year → module tabs, Modules/Tasks toggle, "at-risk" task list, task
  cards with detail + time-tracking.
- ✅ **OneNote** — connect a Microsoft account, link a module to a OneNote
  section, list its pages. Pages open *in* OneNote (can't read handwriting
  via the API, so in-app reading was dropped).
- 🚧 Notes-doc → todos with a progress bar — code shipped, **DB migration
  not run**, so it shows "0 linked todos" until that's fixed.
- ✅ Perplexity research links inside modules (URL + note, manual only).
- ❌ **Dedicated research panel with saved conversation links** — this is
  build-list item #7, still not done.

### Lectures (`/lectures`)
- ✅ Timetable read straight from the Durham MyTimetable ICS feed
  (`TIMETABLE_ICS_URL`, cached 1h) — not via Google, so it's fresh within
  the hour and survives the weekly Google re-auth.
- ✅ Per session: paste reading links (Talis/Blackboard are 2FA-locked, so
  links only — never fetched), tick them off, "no readings for this one",
  "Notes taken" and a short note. Traffic light: red = no readings added,
  amber = some to do, green = all done; a tick = notes taken.
- ✅ "Next 7 days" list + one card per module code; Create workspace makes
  the module workspace (`workspaces.module_code`), which then lives on
  `/lectures`, not `/workspaces`, and has a Lectures section.
- ✅ The same lights on `/calendar` (month dots, week/day pills, agenda);
  clicking a session opens an anchored popover with its prep.
- 🚧 Needs `20261019000000_lecture_sessions.sql` applied — until then lights
  are all red and ticks don't save.

### Money (`/money`)
- ✅ Overall balance, per-account cards, transactions list.
- ✅ **Starling** — live balances + Spaces, transaction sync.
- ✅/⚠️ **PDF bank-statement import** — generic parser, mandatory review
  step. Never tested on a real multi-year re-upload.
- 🐛 Hide-accounts — needs a migration applied on the live DB, and the
  headline balance still includes hidden accounts.
- ❌ Monzo (Trading212 was tried and removed). Spending-by-category
  drill-down, income-by-sender, move-transaction-between-categories,
  sender→category rules. Shrinking the oversized action buttons.

### Todos & Reminders (`/todos`)
- ✅ Todos with lists (colour chips), one level of subtasks, due-time,
  List / Extended / Completed views, stars (+ Starred filter), a
  workspace chip on todos filed under a workspace.
- ⚠️ **Microsoft To Do sync** (replaced Apple Reminders/CalDAV, which never
  worked — iCloud only serves placeholder lists for upgraded Reminders).
  Pull on /todos load (and every 5 min from Daily Goals); ticks, stars,
  title/notes/due-date/reminder-time/list edits and deletes push straight
  back. **Every todo is created in To Do too**, wherever it's added (home,
  /todos, a workspace, Capture, notes documents); subtasks become To Do
  steps; older app-only todos are backfilled on the next pull. Status line
  with Connect/Reconnect on /todos. Written and unit-tested, **not yet
  run against a real Microsoft account**.
- ✅ Edit a todo from every list (home, /todos, workspaces, notes
  documents) with the same editor (incl. workspace + star). Rows always
  show the date and reminder time, and the workspace chip.
- ❌ Natural-language "add a reminder" (vs todo), multi-select → move to
  another list.

### Habits (`/habits`)
- ✅ Daily / specific-day / X-times-per-week habits, completion heatmap,
  streaks. Health-type habits (Running/Gym rings) share the same system.

### Health (`/health`) 👻
- 👻 Running/Gym rings, manual activity logging, Strava **CSV** import
  (not a live API) — all written, all **hidden** right now with a note
  "Bevel already covers this, not worth the effort". Not in the nav.
- (There's an older plan to add a Fitbit integration + a Sleep widget,
  on hold pending the device — may be dead given Health is parked.)

### People / CRM (`/people`)
- ✅ Directory, interactions log, follow-ups, places, all with detail +
  form modals.
- ✅ **NL quick-add bar** — "met Sarah at the library, she does climate
  policy" → Gemini drafts a person/interaction/follow-up → I confirm.
- ✅ **Google Contacts** — two-way sync (pull + push one card back).
  Token dies every 7 days while the Google app is in "Testing" mode.

### Calendar (`/calendar`)
- ✅ Month / Week / Day grids (real 24-hour grid), Grid/Agenda toggle,
  hour-density zoom.
- ✅ **Google Calendar** (read-only; Google is the source of truth).
- ✅/🐛 **Routines** — build a template, drag it onto a day, it creates a
  real Google event. Bug: clicking a routine yanks the panel up the page.
- ✅ "Auto time-block today" wizard — suggests free slots, creates events.
- ❌ **No manual "add event" form at all** — events only come from AI Act,
  routines, or the time-block wizard.

### Bible (`/bible`)
- ✅ One active study at a time, session-by-session question walkthrough,
  topical index, passage lookup + notes. **Zero AI.** Studies imported by
  pasting JSON. A prompt launcher builds a copyable prompt for a separate
  Claude Project (this is the "app assembles context, I think in Claude"
  pattern).

### Research / Prompt Library (`/research`)
- ✅ Prompt cards (click to copy), Perplexity link store (foldered).
- ❌ No search box (despite being called "searchable"), no "auto-organize",
  no home quick-copy card.

### Brain Dump (`/brain-dump`)
- ✅ Paste a paragraph → Gemini splits it into multiple typed drafts
  (todos, tasks, people, events) → confirm each. **This is the closest
  thing to frictionless capture that already exists** — it just isn't
  surfaced anywhere prominent.

### AI (`/ai-usage`)
- ✅ Every Gemini call is logged with real token counts + cost estimate.
  Daily cap of 200 calls. Usage page + home glance.
- ❌ A widget showing Claude session/weekly limits.

---

## What's decided about direction (2026-09-01)

- **Phone = PWA**, not a native app (native needs a paid Apple developer
  account, which I won't buy). Install to home screen, offline reads +
  queued writes, push, share-sheet capture.
- **Keep Gemini**, fix its UX (explicit modes, better prompts).
- **Capture-first is the priority** — a Quick Capture box everywhere, plus
  "Alexa/Siri → Apple Reminders → pulls into the app".
- It has to *remove* friction, not add it.

Full roadmap: `.claude/plans/do-a-comprehensive-look-mutable-church.md`

---

## Brain-dump prompts (things to decide)

1. What do I actually want to capture on the move, and where should it
   land? (todos, fleeting notes, links, reading, ideas, people…)
2. Which of these modules do I genuinely want, and which are noise?
   Candidates to cut/park: Health, Bible-in-app, the depth of the CRM,
   Strava CSV, PDF statement import.
3. What do I want to *recall*, and how? (search, a daily view, a weekly
   review…)
4. What's the one screen I'd want on my phone's home screen?
5. Where does Claude fit — in-app, or "app builds a prompt, I think in
   Claude, paste back" (like the Bible module)?
6. What would make me open this tomorrow morning?

---

## Behaviour reference (moved from CLAUDE.md, 2026-10-01)

Detailed per-feature behaviour, kept current as features change. Rules
Claude must follow live in `CLAUDE.md` and the nested `CLAUDE.md` files.

### Home page (`app/page.tsx`)
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

### Modules

#### Todos (`/todos`, `todos` + `todo_lists`)
- Lists (colour chips), one level of subtasks, due date + time, List /
  Extended / Completed views, a **Starred** filter (starred sort first).
- A todo filed under a workspace (`todos.workspace_id`) shows that
  workspace's coloured chip everywhere (Todos rows, detail view, Daily
  Goals). Workspace todos are ordinary todos — they appear in `/todos` and
  Daily Goals like any other.
- **Microsoft To Do sync** (replaced Apple Reminders): pull on `/todos` load
  (`/api/microsoft/todo/pull`), push on every add and change
  (`/api/microsoft/todo/push`, engine `lib/microsoft/todo-sync.ts`):
  create, tick, star (= To Do "Important"), title, notes, due date +
  reminder time (`due_time` ↔ To Do reminder), list (recreates the task in
  the new list), delete (deletes the task first; if that fails the todo is
  kept). **Every todo is created in To Do** — from home, /todos, workspaces,
  Capture and notes documents; a failed create is retried by the next pull,
  which also backfilled older app-only todos (open ones, ≤25 per pull).
  Subtasks sync as To Do **steps** (`mstodo_checklist_item_id`). To Do lists
  map to app lists by name both ways (the default "Tasks" list = no list;
  missing lists are created on either side). Tasks deleted in To Do are
  deleted here — now that covers every synced todo. Completed tasks older
  than 30 days aren't imported. `education_tasks` are a separate table and
  don't sync. A status line on `/todos` shows synced / Connect / Reconnect.
- **Editing everywhere:** `TodoFormModal` is the one editor (title, date,
  reminder time, list, workspace, star, notes), opened from /todos, the
  home checklist, workspace next actions and notes documents. Every row
  shows the due date + reminder time (`lib/todos/format.ts`); the detail
  view lists linked workspace sources.
  One Microsoft connection (`integrations` provider `microsoft_onenote`,
  scopes Notes.Read + Tasks.ReadWrite) serves OneNote and To Do.
- **Why not Apple Reminders:** iCloud CalDAV only serves placeholder
  "⚠️" lists for upgraded Reminders (tsdav also defaulted to a VEVENT
  filter), so the old CalDAV pull never imported anything. The CalDAV code
  was removed; `todos.caldav_uid` / `upsert_caldav_todos` remain unused.

#### Education (`/education`)
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

#### Workspaces (`/workspaces`, `/workspaces/[id]`)
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
- **Finishing sources**: a source can be ticked done like a todo
  (`workspace_links.completed_at`, migration `20260921000000` — apply by hand).
  It greys out for 5 s, then drops into a collapsed "Completed" sublist
  (untick to restore). Completed sources are skipped by Launch set and the
  Sources stat, and exported under "### Completed". Logic:
  `lib/workspaces/completed.ts`.
- **Weekly readings** (Layout → Weekly readings; hidden by default): a
  column of links tagged with `workspace_links.week`, grouped by week with
  an overall progress bar and per-week counts. Ticking uses `completed_at`
  but a reading stays in its week. Any source moves in/out via its Week…
  control. Logic: `lib/workspaces/readings.ts`.
- **Study time** (Layout → Study time; hidden by default): a stat card with
  this week's hours (ring vs an optional `weekly_minutes_target`, else last
  week) and a Log time popover — 15-minute chips or exact minutes, any past
  day, optional note; this week's entries editable. Entered by hand from
  Opal (no Opal API). Table `workspace_time_logs`; logic
  `lib/workspaces/time.ts`. Separate from Education's `time_logs`.
- **Module overview:** workspace cards on `/workspaces` show the readings
  bar and hours this week when those sections are on, so a "Year 1
  modules" folder shows every module's progress together.
- **Launch set** opens every source in a tab; browsers block all but the
  first unless pop-ups are allowed, so it reports blocked tabs, explains how
  to allow them, and offers "Open next".
- An (i) help popover on both pages explains all of this
  (`WorkspacesHelp.tsx`) — keep it in sync when behaviour changes.
- Logic: `lib/workspaces/{folders,layout,tags,launch,glance,stats}.ts`.

#### Habits (`/habits`, `daily_goal_habits` + `daily_goal_habit_completions`)
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

#### People (`/people`)
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

#### App Library (`/apps`, `link_folders` + `quick_links`)
- All folders open by default (collapse state remembered per browser),
  Expand/Collapse all. Folder toolbar: **+** (add a link straight into that
  folder), drag handle, edit, delete; the virtual "Unfiled" folder only has
  +. Folders and links reorder by drag and drop, and links can be dragged
  between folders. `quick_links.sort_order` is global (the home launcher
  sorts pinned links by it), so moves renumber all links in display order
  (`lib/app-launcher/order.ts`). `link_folders.color` can't be teal.
- **Archive** links and folders (`archived_at`; an archived folder hides
  its links too). They move to a collapsed "Archived" section at the
  bottom and drop off the home launcher; drag renumbering ignores them and
  unarchiving puts a link at the end of its folder.
- Add/edit shows a spinner while it saves (the favicon lookup takes a
  moment) and ignores repeat clicks; a URL that's already in the library
  (archived included) gets a warning and an "Add anyway" button. Workspace
  sources and readings get the same guard.

#### Money (`/money`)
- Starling (live balances + Spaces, transaction sync) and PDF bank-statement
  import (generic parser, mandatory review step). Trading212 was tried and
  removed; Monzo isn't built.

#### Bible (`/bible`)
- Standalone module, no home widget. Keyed off `bible_passages` (a
  normalised book/chapter/verse reference — never scripture text, never a
  Bible API). One `status = 'active'` study at a time (partial unique
  index); studies are paste-JSON imports (`import_bible_study`), with
  per-question `answered_at` for pause/resume. Zero AI calls — the prompt
  launcher only builds a copyable prompt for a separate Claude Project.

#### Research (`/research`)
- Prompt library (`prompts`) and saved Perplexity chats (`perplexity_links`
  — manual link saving, no public API). The home card shows counts.

#### Alexa reminders (`app/api/alexa`, `lib/alexa/`)
- A private Alexa skill ("Alexa, tell Study Copilot to remind me tomorrow at
  3pm to do the washing up") creates a Microsoft To Do task (due date +
  reminder, so the phone alerts) and an Outlook calendar event, then comes
  into the app on the next To Do pull. Alexa is voice input only: skills
  can't read native "Alexa, remind me…" reminders and Amazon has no webhook
  for them, and the old Cortana / IFTTT / Lists-API bridges are dead — so
  native reminders don't sync. Setup: `docs/alexa-skill-setup.md`.
- `/api/alexa` is public in `proxy.ts` and protects itself: Amazon signature
  + timestamp (`lib/alexa/verify.ts`), then skill id and Amazon user id must
  match env. Writes use the service-role client with the owner's stored
  Microsoft connection. Vague dates/times are re-asked, never guessed.
- Outlook events aren't shown on the app's Calendar page (Google only).
  Alexa+ has made "tell <skill>…" unreliable for some skills (2026).
- Fallback if that breaks: Alexa adds a calendar event and the site mirrors
  it into To Do (not built).

#### Brain Dump (`/brain-dump`)
- Long free-text → drafts (todos, education tasks, calendar events, new or
  updated people, logged conversations), reviewed with the same shared
  draft list as Capture.

### Using Education and Workspaces together
- **Education** is the official record: year → module, assessed deadlines,
  grades, time logged, OneNote.
- **Workspaces** is where the work happens: sources, next actions, thinking
  log.
- Lecture prep lives in **module workspaces** (Lectures tab): one per
  module code, sessions from the timetable, readings per session.
- For an essay: add the deadline in Education **and** create a workspace
  (subtitle = module), filed under a folder like Uni › Year 2. Non-uni
  projects (e.g. the Christian clothing brand) are workspace-only — hide the
  sections they don't need.
- If one side goes unopened for a few weeks, revisit whether both are
  needed.

### Obsidian (guidance only — nothing built)
- Obsidian itself is free. Keeping the vault in iCloud Drive syncs Mac ↔
  iPhone for free (Obsidian Sync is the paid alternative).
- Using the Claude subscription with it: point a filesystem MCP server in
  Claude Desktop at the vault folder, or run Claude Code inside the vault.
  The Claude phone app can't read local files.
- Possible future link: export a workspace's Markdown straight into the
  vault.

