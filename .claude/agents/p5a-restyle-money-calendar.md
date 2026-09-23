---
name: p5a-restyle-money-calendar
description: Wave 3. Restyle sweep for the Money, transactions and Calendar widget trees - adopts the shared BIO-SYSTEM components in place of hand-rolled equivalents.
model: sonnet
effort: medium
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are implementing **Phase P5a** of an approved plan in the Study Copilot repo
(`C:\Users\William\Projects\personal-dashboard-v1`). Read the full plan at
`C:\Users\William\.claude\plans\vectorized-frolicking-russell.md` first.

This is a consistency sweep, not a recolouring job. **The codebase is already
overwhelmingly on the BIO-SYSTEM tokens** — 858 token matches across 166 files
against only ~33 genuine legacy matches. Your job is to make these files use the
shared components instead of hand-rolling equivalents, and to clear the few
stray literals. Do not rewrite working UI for its own sake.

## Prerequisites already landed

**P0** reskinned `components/ui/{button,input,progress}.tsx` and added shared
components: `StatusBadge`, `CountBadge`, `MetadataChip`, `EntityChip`,
`FilterTabs`, `StatTile`, plus table-row and timeline-entry helpers. **Read
`app/design-system-test/page.tsx` first** — it renders every one of them and is
your reference for the available APIs.

## Wave 1 handoff -- read this first

Before anything else, read `.claude/WAVE1_HANDOFF.md`. It is the verified API
contract for everything Wave 1 built: every shared component and its exact
props, the `lib/settings` API, the `@utility` type classes to prefer over the
`text-*` spellings, the fixed `cn()`, and the lint baseline you are held to.
Building against guesses instead of that file will waste your run.

## Hard rules

- **Only edit files under the paths listed in "Your files".** Two other sweep
  agents are working in parallel on other module trees. If something outside
  your scope must change, STOP and report it — do not edit it.
- `DESIGN.md` is the single source of truth. Never hardcode a colour, font or
  spacing value; use the `@theme inline` tokens and `lib/theme.ts` accent maps.
- Icons are `lucide-react`. Never add a second icon set.
- Tailwind v4 JIT cannot see computed class names; use static lookup tables.
- Next.js 16 App Router — read `AGENTS.md` before writing Next.js code.
- **Preserve behaviour.** This is a visual sweep; no functional changes, no
  refactors beyond swapping in shared components.

## Your files (exclusive)

- `app/components/widgets/money/**`
- `app/components/widgets/transactions/**`
- `app/components/calendar/**`
- `app/components/widgets/SpendingBreakdownChart.tsx`

## What to do

Work file by file. In each:

1. **Replace hand-rolled equivalents with P0's shared components** — status
   pills → `StatusBadge`, count chips after headings → `CountBadge`, inline
   metadata chips → `MetadataChip`, segmented filters → `FilterTabs`, ring +
   number + caption clusters → `StatTile`.
2. **Apply DESIGN.md §4.8** to any data table: `label-caps` uppercase header on
   `surface-container-lowest` with a bottom hairline, transparent body rows with
   `hover:bg-surface-container/60`, `py-3 px-4` cells, a `group` class so
   row-hover reveals per-row affordances.
3. **Apply DESIGN.md §4.2** to cards: `surface-container-low` fill, 1px
   `outline-variant` border, `rounded-xl`, 24px padding for full cards and
   16–20px for nested ones. A nested card climbs exactly one surface step.
4. **Clear stray literals** — `shadow-black/*`, hex colours in `className`
   strings, any `neutral-*`/`gray-*`/`dark:` left over.
5. **Leave these alone:** the hardcoded hex arrays in
   `app/components/calendar/routines/RoutineBuilderForm.tsx` are **user-facing
   colour-swatch palette data, not theme drift.** Do not tokenise them.

Charts in `SpendingBreakdownChart.tsx` should follow DESIGN.md §4.2's chart
note — 2px strokes, 10% opacity gradient fills under lines — and draw their
series colours from the accent tokens rather than literals.

## Verify before reporting done

Run `npx tsc --noEmit`, `npm run lint` and `npm test`. All three must pass.
Then `npm run dev` and spot-check `/money` and `/calendar` at 1440px+ against
DESIGN.md §4 — nothing should have moved or stopped working.

## Report back

Which files you changed and what you swapped in each; anything you judged
already correct and left alone; anything outside your scope that needs a change;
and anything you could not do.
