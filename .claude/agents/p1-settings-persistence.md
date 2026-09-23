---
name: p1-settings-persistence
description: Wave 1. Creates the user_settings table migration plus the pure settings schema and the client hook that every later UI phase reads and writes.
model: sonnet
effort: medium
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are implementing **Phase P1** of an approved plan in the Study Copilot repo
(`C:\Users\William\Projects\personal-dashboard-v1`). Read the full plan at
`C:\Users\William\.claude\plans\vectorized-frolicking-russell.md` first.

This is well-precedented work: the migration copies a convention documented
verbatim in `CLAUDE.md` and repeated across 56 existing migrations, and the hook
copies an existing hook almost directly. Follow the precedents rather than
inventing.

## Hard rules

- **Only edit the files listed under "Your files".** Other agents are editing
  other files in parallel right now. If something outside your scope must
  change, STOP and report it — do not edit it.
- Read `CLAUDE.md` for project conventions, especially "Data model conventions".
- Migrations are **applied by hand**, so write them re-runnable: `if not
  exists`, `drop policy if exists`, guarded constraints, `create or replace`.
  You ship the file; William applies it.
- Pure logic lives in `lib/**` with a colocated `.test.ts` (vitest).
- Next.js 16 App Router — read `AGENTS.md` before writing Next.js code.

## Your files (exclusive)

- `supabase/migrations/<timestamp>_user_settings.sql` (new — use a timestamp
  later than the newest existing migration)
- `lib/settings/**` (new directory)
- `lib/types.ts`

## What to do

### 1. The migration

```sql
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid()
    references auth.users(id) on delete cascade,
  home_layout       jsonb  not null default '[]'::jsonb,
  hidden_nav_items  text[] not null default '{}',
  launcher_link_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
```

- `home_layout` holds `[{ id, span, hidden }]` in render order.
- `hidden_nav_items` holds `navItems` hrefs.
- `launcher_link_ids` holds `quick_links.id` values — **membership and order in
  one ordered array**. This is the launcher's single source of truth from now
  on; `quick_links.is_pinned` is retired.
- Four own-row RLS policies (select/insert/update/delete), `revoke ... from
  anon`, exactly as every other table in `supabase/migrations/` does. Copy the
  shape from a recent migration rather than writing it from memory.

### 2. Pure schema module

`lib/settings/schema.ts` + `lib/settings/schema.test.ts`:

- Types for the settings row and for a home-layout entry.
- Defaults for a user who has no row yet.
- A **tolerant** normalisation/merge: unknown widget ids in `home_layout` are
  dropped, known widgets missing from it are appended with defaults, spans are
  clamped to 1–4. The app must never break because a widget was added or
  removed in code. Cover these cases in the test.

Model the file's style on `lib/workspaces/layout.ts` and
`lib/app-launcher/order.ts` — pure, dependency-free, framework-agnostic.

### 3. The client hook

`lib/settings/use-settings.ts`:

- Follow `lib/workspaces/use-workspaces.ts:87-101` exactly for the write path:
  optimistic local update, then the Supabase write, then roll back local state
  and surface an error message if the write fails.
- Client-side Supabase via `lib/supabase/client.ts` (or the `lib/supabase.ts`
  singleton — check which the comparable hooks use).
- Upsert on write, since the user may have no row yet.
- **Critical:** the migration is applied by hand, so the table may not exist
  when this code first runs. A missing-table or permission error must fall back
  to the defaults from `schema.ts`, not throw or leave the UI broken. Test or
  at minimum guard this path explicitly.

### 4. Types

Add the row type to `lib/types.ts` alongside the existing table mirrors (see
`LinkFolder` / `QuickLink` around lines 420-441 for the house style).

## Verify before reporting done

Run `npx tsc --noEmit`, `npm run lint` and `npm test`. All three must pass.
Report any failure you could not fix rather than hiding it.

## Report back

What you changed; the exact exported API of `schema.ts` and `use-settings.ts`,
since three later agents consume it; the migration filename; and anything you
could not do.
