---
name: p3-home-grid
description: Wave 2. Rebuilds the home bento grid so widgets can be reordered by drag, resized by snapping to column spans, auto-size to their content by default, and be shown or hidden.
model: opus
effort: high
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are implementing **Phase P3** of an approved plan in the Study Copilot repo
(`C:\Users\William\Projects\personal-dashboard-v1`). Read the full plan at
`C:\Users\William\.claude\plans\vectorized-frolicking-russell.md` first.

This is the most bug-prone phase in the batch — drag, resize and persistence all
interacting. Take the time to get the state model right before writing UI.

## Prerequisites already landed

- **P0** reskinned the `components/ui` primitives and added shared components
  (`StatusBadge`, `CountBadge`, `MetadataChip`, `EntityChip`, `FilterTabs`,
  `StatTile`, table/timeline helpers). Read `app/design-system-test/page.tsx`
  to see what exists and use them rather than hand-rolling. P0 also owns
  `app/components/WidgetCard.tsx`, which your widgets render inside — read it,
  do not edit it.
- **P1** created `lib/settings/` — `schema.ts` and `use-settings.ts`
  (optimistic write, falls back to defaults if the table is missing). Read both.
  `home_layout` (`[{ id, span, hidden }]` in render order) is your field.

## Wave 1 handoff -- read this first

Before anything else, read `.claude/WAVE1_HANDOFF.md`. It is the verified API
contract for everything Wave 1 built: every shared component and its exact
props, the `lib/settings` API, the `@utility` type classes to prefer over the
`text-*` spellings, the fixed `cn()`, and the lint baseline you are held to.
Building against guesses instead of that file will waste your run.

## Hard rules

- **Only edit the files listed under "Your files".** Two other agents are
  editing other files in parallel right now. If something outside your scope
  must change, STOP and report it — do not edit it. In particular
  `app/components/WidgetCard.tsx` belongs to P0 and
  `app/components/widgets/app-launcher/**` belongs to P4.
- `DESIGN.md` is the single source of truth for visual design. Never hardcode a
  colour, font or spacing value.
- Next.js 16 App Router with breaking changes. Read `AGENTS.md` and consult
  `node_modules/next/dist/docs/` before writing Next.js code.
- Tailwind v4 JIT **cannot see computed class names.** Span classes must come
  from a static lookup table — copy the technique from `COLUMN_GRID_CLASS` in
  `lib/workspaces/layout.ts`.
- Icons are `lucide-react`.
- Pure logic lives in `lib/**` with a colocated `.test.ts` (vitest).

## Your files (exclusive)

- `app/page.tsx`
- `app/components/home/**` (new directory)
- `app/components/widgets/home/**`
- `lib/home/**` (new directory)

## Current state

`app/page.tsx` is a 30-line **server** component. The grid is a flat
`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` with **zero span classes** — every
widget is an equal 1×1 cell, and render order is literally JSX order. Every
widget is its own `'use client'` component fetching its own data; nothing is
passed down as props today.

## What to do

### 1. Pure layout logic first

`lib/home/layout.ts` + `lib/home/layout.test.ts`:

- A widget **registry**: stable id → display name, default span, default hidden.
  Ids must be stable strings, not array indices, since they persist to the DB.
- Resolve saved `home_layout` against the registry: preserve saved order, append
  newly-added widgets, drop unknown ids, clamp spans to 1–4.
- `reorder`, `setSpan`, `toggleHidden` as pure functions.
- The static span-class lookup table.

Model the style on `lib/app-launcher/order.ts` — pure and dependency-free.

### 2. HomeGrid

New `app/components/home/HomeGrid.tsx`, a client component:

- Reads settings via P1's hook, renders widgets in saved order at saved spans.
- `grid-cols-4` with `auto-rows-min` and `items-start`, so **height auto-fits
  content by default** — that is the user's stated default, not a fixed row
  height.
- Passes `span` down to each widget as `span?: 1 | 2 | 3 | 4`. **This prop name
  and type are a fixed contract** — P4's `AppLauncherGlance` consumes exactly
  this to decide how many app tiles to show. Do not rename it.
- `app/page.tsx` becomes a thin wrapper rendering `<AiQueryBar />` and
  `<HomeGrid />`. It will likely need `'use client'` or to keep the client
  boundary inside `HomeGrid` — check the Next.js 16 docs for the cleaner option.

### 3. Edit mode

- A toggle that puts the grid into edit mode; outside edit mode the grid is
  exactly as calm as it is today, with no handles visible.
- **Reorder:** `@dnd-kit/sortable` with a grip handle in each widget header.
  Copy the pattern from `app/components/widgets/habits/HabitCard.tsx:50-83` —
  `useSortable`, listeners on the handle only (never the whole card, or the
  widgets' own buttons stop working), `PointerSensor` with
  `activationConstraint: { distance: 4 }`.
- **Resize:** a corner handle that snaps the column span 1→4 as the pointer
  crosses column boundaries. Roughly 40 lines of pointer math against the grid's
  measured column width. No new dependency — `react-grid-layout` was explicitly
  rejected because its fixed row heights fight auto-sizing.
- **Show/hide:** a per-widget control in edit mode plus a list of hidden widgets
  that can be restored. Hidden means not rendered, data untouched — mirror the
  semantics of `hidden_sections` in `lib/workspaces/layout.ts`.
- Persist through P1's hook on each change: optimistic local update, then write.

### 4. Widget housekeeping

- `app/components/widgets/home/HealthGlance.tsx` exists but nothing renders it,
  and `/health` is `notFound()`. Decide explicitly: register it as
  hidden-by-default, or delete it. Say which you chose and why.
- Widgets that should respond to their span (showing more rows when wide) may
  do so, but every widget must render correctly at all four spans.
- `CalendarModule` lives at `app/components/modules/CalendarModule.tsx`, which
  is **outside your scope**. Render it from `HomeGrid` by import; if it needs a
  code change to accept `span`, report that rather than editing it.

## Verify before reporting done

Run `npx tsc --noEmit`, `npm run lint` and `npm test`. All three must pass.
Then `npm run dev` and check at 1440px+: drag to reorder, drag the corner to
resize, hide and restore a widget, and reload to confirm all three persist.
Confirm widgets still auto-size to content when untouched.

## Report back

What you changed; the widget registry ids; the `HealthGlance` decision; whether
`CalendarModule` needs a change outside your scope; any decision the plan left
open that you made; and anything you could not do.
