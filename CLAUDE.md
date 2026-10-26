# Study Copilot

A single-user personal dashboard. I'm a Geography student and use it every day; it is not a demo.

## Framework
- Next.js 16 App Router, which has breaking changes. Read `AGENTS.md` and `node_modules/next/dist/docs/` before writing Next code (e.g. `searchParams` is a Promise).
- `npm test` runs vitest. Pure logic lives in `lib/**`, with `x.test.ts` next to `x.ts`.

## UI
- Desktop-first (1440px+). Mobile is out of scope for now; the phone will be a future PWA.
- Bento grid: no module's card visually dominates another.
- Dark-only "BIO-SYSTEM" theme. Don't add light-mode styling.
- **All UI follows `DESIGN.md`**, the single source of truth for colours, typography, spacing and component styles. No hardcoded colours, fonts or spacing. Tokens: `app/globals.css` (`@theme`) and `lib/theme.ts` (accent → class maps, `MODULE_ACCENT`). `/design-system-test` renders every shared component in every variant and accent; read it before building new UI.
- `cn()` (`lib/utils/cn.ts`) registers the custom type scale with tailwind-merge. Add any new `--text-*` token to its `TYPE_SCALE`, or `cn()` silently drops that size next to a text colour.
- Icons: `lucide-react` only (translate the mockups' Material Symbols).
- Some glass/refraction effects are Chromium-only. Check them in Safari before shipping.
- Reuse these shared building blocks instead of re-creating them:
  - `components/ui/` (import per file, no barrel): `Button`, `Input`, `Progress`, `ProgressRing`, `StatusBadge`, `CountBadge`, `MetadataChip`, `EntityChip`, `FilterTabs`, `StatTile`, `DataTable*`, `Timeline`/`TimelineEntry`. They take an `accent`; `accent="ws"` follows the workspace's `--ws-accent`.
  - `LoadingGlowBorder` (every AI/search input)
  - `LiquidSwitch`
  - `Popover` / `InfoPopover`: in-place, not portalled, so `--ws-accent` applies
  - `Modal`: portalled
  - `ConfirmDialog`
  - `AccentPicker`
  - `onActivateKey` (`lib/utils/a11y.ts`)
  - `useStoredIdSet`
  - `lib/ui/pagination.ts`
- Drag and drop: `@dnd-kit` with a grip handle (see `HabitCard`).
- Calendar event details open in an anchored popover or bottom sheet, never a full-screen modal.
- Page titles: a page publishes its context once with `usePageTitle(...)` (`lib/page-title.ts`), which feeds the breadcrumb and browser tab title. It's a hook, so keep it above any early return (see `WorkspaceDetailBoard.tsx`).
- Nav tabs can be hidden from the settings menu (`user_settings.hidden_nav_items`); `Sidebar` and `MobileBottomNav` both read `useVisibleNavItems()`.
- Home grid (`HomeGrid`) is user-arranged: order, column span (1–4) and hidden state persist in `user_settings.home_layout`. Adding a widget means an entry in `HOME_WIDGETS` (`lib/home/layout.ts`) and in `HOME_WIDGET_COMPONENTS` (`app/components/home/widget-registry.tsx`). Widget ids persist to the DB, so keep them stable. Don't add home widgets casually.
- `/health` returns `notFound()` on purpose.

## AI
- Every AI call goes through `lib/ai/gemini.ts`. Don't import a provider SDK anywhere else.
- Every call is logged to `ai_usage` (append-only, one row per call, with a feature key). The daily cap is set in `lib/ai/constants.ts`.
- Find mode: AI only extracts keywords. The queries themselves are hand-written `ilike` lookups, with no AI in query execution.
- Capture and Brain Dump only produce drafts. Nothing is written until the user confirms it (`/api/capture/confirm`).

## Data (Supabase)
- Migrations are applied by hand, so a migration file may not be live. Write migrations to be re-runnable. See `supabase/CLAUDE.md`.
- Every table has `user_id default auth.uid()`, four own-row RLS policies, and `revoke … from anon`.
- Dates are Europe/London calendar days (`lib/google/london-day.ts`).
- Habit completions are dated rows (unique per habit + day), never a boolean.
- Habit steps (`habit_steps`) are not Calendar routines (`routines*`, which are timed and have no done state).
- Known split: Education pages use `tasks`, while Daily Goals, the time-block wizard and Capture use `education_tasks`. This is unresolved. Don't silently "fix" one side.
- Dead tables and columns; don't use them:
  - `habits`, `habit_logs`, `rugby_sessions`
  - `todos.caldav_uid`, `upsert_caldav_todos`
- `quick_links.sort_order` is global. A move renumbers every link (`lib/app-launcher/order.ts`).
- `link_folders.color` can't be teal.
- `user_settings`: one row per user for UI layout and visibility (`home_layout`, `hidden_nav_items`, `launcher_link_ids`), via `useSettings()` (`lib/settings/use-settings.ts`). Falls back to defaults when the row or table is missing.
- Lecture prep: the timetable is never stored — it's read from the ICS feed (`lib/timetable/CLAUDE.md`). `lecture_sessions` holds per-session state keyed by ICS UID (or `gcal:<id>` for a Google event with prep tracked); module readings are `workspace_links` with `session_uid`; tasks and post-session concepts are `session_tasks`; `workspaces.module_code` marks a module workspace. Prep is green only once handed in with Mark as done (`prep_done_at`); follow-up never makes a session overdue.
- `launcher_link_ids` is the home launcher's membership and order. `quick_links.is_pinned` is retired: it's only read once to seed that array.

## Integrations and boundaries
- Microsoft To Do is the phone-side todo app. Don't reintroduce Apple Reminders or CalDAV. Sync rules: `lib/microsoft/CLAUDE.md`.
- Instagram: no API, scraping or automation. Follows are imported only from the user's data export (`following.json`), and re-importing is additive-only.
- Perplexity: links are saved manually. There is no public API.
- Bible: store references only, never scripture text. No Bible API, zero AI calls.
- `/api/alexa` is public in `proxy.ts` and verifies requests itself (`lib/alexa/CLAUDE.md`).
- No push or email notifications are built yet.
- Env vars are documented in `.env.example`. Never commit values.

## Focus Timer
- Spec: `docs/specs/focus-timer-spec.md`. Phase 1 (schema + API) is built; there's no UI yet.
- The timer lives on the server. A running timer is a `time_sessions` row with `ended_at` null. Pause/resume are segments sharing a `session_group_id`, never a flag. State is derived from the latest segment. Discard is `ended_reason = 'discarded'`, and rows are never deleted.
- All logic is in the `timer_*` / `time_breakdown` RPCs (migration `20261019010000`), using `now()` only. `time_entries` unions timer segments with the manual `workspace_time_logs`. The manual "add time" flow is untouched.
- Auth: `lib/timer/auth.ts`. Session cookie, or `TIMER_API_TOKEN` + `TIMER_OWNER_USER_ID` on `/api/timer/*` only. `/api/timer` and `/api/cron` are public in `proxy.ts`. The daily cron (`vercel.json`) uses `CRON_SECRET`.

## Docs
- `docs/FEATURE_INVENTORY.md`: what's built, how each feature behaves, and the Education + Workspaces workflow.
- `docs/BACKLOG.md`: known bugs and the backlog.
