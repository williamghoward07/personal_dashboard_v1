# Study Copilot

Personal, single-user dashboard for daily use as a university Geography student.
Not a demo project — built for my own real use. Bento-grid layout, no module
(academic/finance/fitness) visually dominates another. Central AI query box
connects across modules.

## Design philosophy
- Equally weighted, self-contained widget cards in a bento-grid
- Desktop/web-first, designed for 1440px+ screens (current priority)
- Mobile companion app is a future phase — explicitly out of scope now
- Research prompts library is standalone, not nested under academics
- Notion-style tailored views per task (e.g. clicking an essay shows a
  bespoke checklist for that task, not a generic template)
- Visual design system: "BIO-SYSTEM" dark cyber-kinetic theme (committed
  dark-only, not light/dark-adaptive). Deep charcoal/green surface scale,
  Geist for headings/data, Inter for body text, glassy bento cards with a
  hover glow in the active module's accent color. Per-module accent colors:
  mint = Health, electric blue = Money, orange = Education, pink = Research,
  purple = Habits. Tokens live in `app/globals.css` (`@theme`) and
  `lib/theme.ts` (accent → class maps). Icons stay on `lucide-react`
  (not the reference mockups' Material Symbols) to avoid a second icon
  system — reskin new UI to match this rather than reverting to the old
  neutral light/dark styling.
- Glass effects: prefer an existing component library over hand-rolled
  CSS (e.g. glinui — Radix + Tailwind, ships elevation/blur/motion
  tokens) so widgets consume shared tokens rather than each inventing
  the effect. Some glass/refraction effects render Chromium-only —
  verify Safari before relying on one for a shipped widget, since an
  iOS app is a planned future phase.

## Tech stack
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend/Auth/DB: Supabase
- Deployment: Vercel
- AI: Gemini (aistudio.google.com), behind a swappable interface in
  `lib/ai/gemini.ts` — every AI call site imports only from there, so a
  provider switch (e.g. to Claude) only touches that one file. Currently
  powers the home page's search box and the People quick-add bar; a
  dedicated Education/research panel is still unbuilt (deferred, see
  Features below)

## Home page widgets (v1 layout, decided)
Seven widgets on the bento grid, each self-contained:
- **Habits** — rings only (circle + title underneath). Daily / specific-day
  habits only; health-specific habits live in the Health widget instead.
- **Health** — progress rings for Running and Gym (see habit model below),
  alongside other health tracking (e.g. manual rugby session logging).
- **Daily Goals** — top: roll-up progress ring for TODAY across todos +
  education_tasks + habits combined, with a fraction underneath (e.g.
  "5/8 today"). Bottom: checklist of general todos only — not education
  tasks, not habits, those are counted in the ring but managed in their
  own widgets. Divider between the two sections.
- **Education** — absorbs the standalone Research widget. Toggle between
  Modules and Tasks views; defaults to "nothing due soon" when empty.
  Research links (Perplexity etc.) live inside modules, not a separate
  widget.
- **Prompt Library** — home widget is a small quick-copy card: title +
  one-line explanation, click copies the prompt. Full searchable/
  organizable library lives on its own page. "Auto-organize" is a UI
  stub for now (tells the user it isn't wired up yet) — the AI infra
  it would need now exists (`lib/ai/gemini.ts`), it just hasn't been
  connected to this specific feature yet.
- **Calendar** — widget shows "nothing on today" (or today's items),
  a horizontal divider, then the next upcoming event with date/time.
  On the full calendar page, clicking an event opens an anchored
  popover (desktop) or bottom sheet (mobile) — never a full-screen
  blocking modal.
- **Daily Verse** — separate small card, date-stable per Europe/London,
  curated selection (not random). Click opens the full surrounding
  passage in a reader. See dedicated feature prompt for API/architecture
  details (source TBD: YouVersion Platform API if it has a suitable
  public endpoint, else API.Bible).

## Data model conventions (decided)
- `todos` — general to-dos only, separate table from education tasks.
- `education_tasks` — separate table, FK to `modules`, not merged with
  general todos even though both surface on Daily Goals.
- `habits` + `habit_completions` — one shared table for ALL habits
  (daily and health), distinguished by a `widget` field (`habits` |
  `health`) and a `frequency_type` field (`daily` | `specific_days` |
  `times_per_week`). Completions are logged as separate dated rows in
  `habit_completions`, never a boolean on the habit — needed for weekly
  counts, streaks, and the "already met this week's target" state.
  Running and Gym are seeded as `times_per_week` habits under `health`.
- Shared `<ProgressRing />` component — used by Habits, Health, and the
  Daily Goals roll-up. Build once, reuse; don't let each widget grow
  its own ring implementation.
- `ai_usage` — append-only log, one row per `generateStructured()` call
  (real token counts, tier, model, an estimated USD cost). Backs the daily
  call cap and the AI Usage bento widget. See the AI Search & Token Budget
  plan (2026-08-18, `lib/ai/`) for the two-tier (`fast`/`smart`) model
  policy this all sits under.

## Tech stack
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend/Auth/DB: Supabase
- Deployment: Vercel
- AI: Gemini (aistudio.google.com), behind a swappable interface in
  `lib/ai/gemini.ts` — every AI call site imports only from there, so a
  provider switch (e.g. to Claude) only touches that one file. Currently
  powers the home page's search box and the People quick-add bar; a
  dedicated Education/research panel is still unbuilt (deferred, see
  Features below)

## Features (build order — easiest to hardest)
1. App shell with placeholder slots for every feature
2. Deadline/checklist view (own DB table, no external API)
3. Manual time tracking + progress visual
4. Manual rugby session logging (Health widget — see habit model for
   Running/Gym rings, which are a separate mechanism from this log)
5. Calendar API integration for day view
6. Strava API (running + Hevy-synced gym sessions)
7. A dedicated research panel with saved conversation links (still
   pending — distinct from the Gemini search/quick-add in item 10,
   deferred alongside the Education rework)
8. Monzo/Starling integration (read-only scopes, encrypted token storage) — Trading212
   was attempted and removed (broken auth against its live API, never fixed);
   PDF bank-statement upload covers accounts without a working read-only API instead.
9. One-way sync (pull) from Apple Reminders via CalDAV, plus a narrow
   completion-push back — see the Environment Variables section
10. Gemini-powered home search box (extracts keywords + relevant modules
    only — no AI in the actual query execution, which is hand-written
    `ilike` lookups) and a People quick-add bar that extracts a new/
    updated contact or a logged conversation from a short typed note

## Decided / out of scope for v1
- No push/email notifications — in-app only, not building for mobile yet
- No data export feature — Supabase's own export covers this
- Perplexity integration is manual link-saving only (no public API available),
  stored within Education modules as a URL + note field, not a separate widget
- Apple Reminders sync is one-way pull (plus completion-push) only — see
  Environment Variables. Todos created in the app stay app-only, never
  pushed to Reminders; editing a synced reminder's title/due date is done
  in Reminders/via Siri, not in the app

## Environment Variables
Required in `.env.local` (see `.env.example` for setup notes). Never commit
actual values.

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
- **Google Contacts (People module)**: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`
- **Microsoft OneNote (Education module, read-only in-app browsing)**:
  `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (Azure app registration,
  "Personal Microsoft accounts only"; reuses `INTEGRATION_ENCRYPTION_KEY`
  above). No indexing/reindexing — every Graph call is made on demand when
  a section or page is actually opened in the app.
- **Starling**: `STARLING_ACCESS_TOKEN`
- **Apple Reminders (Todos page, via CalDAV)**: `ICLOUD_CALDAV_USERNAME`,
  `ICLOUD_CALDAV_APP_PASSWORD` (an app-specific password from
  appleid.apple.com, not your real Apple ID password — Apple doesn't
  support OAuth for CalDAV), optional `ICLOUD_CALDAV_LIST_NAME` (a single
  list name, or a comma-separated list of names to sync multiple lists
  into the same flat pool)
- **Gemini (home search, People quick-add)**: `GEMINI_API_KEY` from
  aistudio.google.com (free tier), optional `AI_ENABLED=false` kill switch
