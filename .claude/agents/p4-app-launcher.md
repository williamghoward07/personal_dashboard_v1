---
name: p4-app-launcher
description: Wave 2. Removes the 7-app cap on the home launcher and adds a menu to choose which apps appear and reorder them, backed by an ordered id array in user settings.
model: sonnet
effort: high
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are implementing **Phase P4** of an approved plan in the Study Copilot repo
(`C:\Users\William\Projects\personal-dashboard-v1`). Read the full plan at
`C:\Users\William\.claude\plans\vectorized-frolicking-russell.md` first.

## Prerequisites already landed

- **P0** reskinned the `components/ui` primitives and added shared components.
  Read `app/design-system-test/page.tsx` for what exists and use them.
- **P1** created `lib/settings/` — `schema.ts` and `use-settings.ts`
  (optimistic write, falls back to defaults if the table is missing). Read both.
  `launcher_link_ids` (a `uuid[]`) is your field.
- **P3** owns the home grid and passes each widget `span?: 1 | 2 | 3 | 4`.
  **This is a fixed contract** — accept exactly that prop name and type on
  `AppLauncherGlance`.

## Wave 1 handoff -- read this first

Before anything else, read `.claude/WAVE1_HANDOFF.md`. It is the verified API
contract for everything Wave 1 built: every shared component and its exact
props, the `lib/settings` API, the `@utility` type classes to prefer over the
`text-*` spellings, the fixed `cn()`, and the lint baseline you are held to.
Building against guesses instead of that file will waste your run.

## Hard rules

- **Only edit the files listed under "Your files".** Two other agents are
  editing other files in parallel right now. If something outside your scope
  must change, STOP and report it — do not edit it.
- `DESIGN.md` is the single source of truth for visual design. Never hardcode a
  colour, font or spacing value.
- Next.js 16 App Router — read `AGENTS.md` before writing Next.js code.
- Tailwind v4 JIT cannot see computed class names; use static lookup tables.
- Icons are `lucide-react`.
- Pure logic lives in `lib/**` with a colocated `.test.ts` (vitest).

## Your files (exclusive)

- `app/components/widgets/app-launcher/**`
- `lib/app-launcher/**`

## Current state

- `AppLauncherGlance.tsx:13` has `const MAX_TILES = 7`, applied at line 60 as
  `links.slice(0, MAX_TILES)`. Pinned links beyond the seventh are silently
  never shown. A static "More" tile linking to `/apps` is always appended.
- Membership today is the `quick_links.is_pinned` boolean; ordering is the
  global `quick_links.sort_order`.
- `AppLibraryBoard.tsx:242` toggles pinning with a bare
  `update({ is_pinned: !link.is_pinned })`.
- `lib/app-launcher/order.ts` holds the existing pure ordering logic —
  `groupLinks`, `displayOrder`, `moveLink`, `linkOrderPatches`,
  `folderOrderPatches`, `applyPatches`. Read it fully; it is the style to match
  and you should reuse it where it fits.

## What to do

### 1. Move to an ordered id array

`launcher_link_ids` in user settings becomes the **single source of truth** for
the launcher: one ordered array encoding both which apps appear and in what
order. This is exactly what the user asked for — "choose which apps appear and
reorder them via a menu, not just pin".

- Seed it once from the existing `is_pinned` rows ordered by `sort_order`, so
  the user's current launcher survives the change. Seed only when the array is
  empty and the user has pinned links; never re-seed over a deliberate choice.
- `quick_links.is_pinned` is **retired** — left in the schema but no longer
  read, matching how `todos.caldav_uid` was retired. Point the `/apps` pin
  control at the new array so it keeps working and stays in sync with the menu.
- Ids in the array that no longer exist as links must be ignored gracefully.

New pure module `lib/app-launcher/launcher-selection.ts` +
`launcher-selection.test.ts`: resolve an id array against the available links
(dropping stale ids), add/remove, reorder, and derive the seed from pinned
links. Cover the stale-id and empty-seed cases.

### 2. Remove the cap, derive the count from the span

- Delete `MAX_TILES`.
- How many tiles render is derived from the widget's `span` prop — a wider
  widget shows more apps. Pick a sensible tiles-per-span mapping and keep the
  existing "More" tile for the overflow. If every selected app fits, the "More"
  tile should still link to `/apps`, since that is its other job.
- The widget must render correctly at all four spans.

### 3. The menu

A menu on the launcher widget listing every `quick_link` with:

- a visibility toggle controlling membership of `launcher_link_ids`, and
- drag-to-reorder for the selected ones.

Use the existing `Popover` from `app/components/` rather than a new overlay
primitive — note the `CLAUDE.md` guidance that it is deliberately in-place, not
portalled. For drag, follow the grip-handle pattern already used in this
codebase (`HabitCard.tsx:50-83`): `useSortable`, listeners on the handle only,
`PointerSensor` with `activationConstraint: { distance: 4 }`. Writes go through
P1's hook: optimistic local update, then persist.

Respect `onActivateKey` (`lib/utils/a11y.ts`) for keyboard activation on
clickable rows — the repo already fixed a bug where Space inside an input
triggered the whole row.

## Verify before reporting done

Run `npx tsc --noEmit`, `npm run lint` and `npm test`. All three must pass.
Then `npm run dev`: select more than seven apps and confirm all appear, widen
the launcher widget and confirm more tiles show, reorder in the menu and confirm
the widget follows, and reload to confirm persistence.

## Report back

What you changed; the tiles-per-span mapping you chose; how you handled the
`is_pinned` seed and the `/apps` pin control; any decision the plan left open
that you made; and anything you could not do.
