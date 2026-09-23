---
name: p5c-restyle-people-habits-workspaces
description: Wave 3. Restyle sweep for the People, Habits, daily-goals, Brain Dump and Workspaces widget trees - adopts the shared BIO-SYSTEM components, including the section 4.8 table and section 4.9 timeline patterns.
model: sonnet
effort: medium
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are implementing **Phase P5c** of an approved plan in the Study Copilot repo
(`C:\Users\William\Projects\personal-dashboard-v1`). Read the full plan at
`C:\Users\William\.claude\plans\vectorized-frolicking-russell.md` first.

This is a consistency sweep, not a recolouring job. **The codebase is already
overwhelmingly on the BIO-SYSTEM tokens** — 858 token matches across 166 files
against only ~33 genuine legacy matches. Your job is to make these files use the
shared components instead of hand-rolling equivalents, and to clear the few
stray literals. Do not rewrite working UI for its own sake.

Your two trees are the ones `DESIGN.md` was written from, so they matter most:
the Instagram follows table is the source of §4.8, and the Workspaces thinking
log is the source of §4.9.

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
  Note `app/components/widgets/home/**` belongs to another phase and is **not**
  yours, even though `daily-goals` is adjacent to it.
- `DESIGN.md` is the single source of truth. Never hardcode a colour, font or
  spacing value; use the `@theme inline` tokens and `lib/theme.ts` accent maps.
- Icons are `lucide-react`. Never add a second icon set.
- Tailwind v4 JIT cannot see computed class names; use static lookup tables.
- Next.js 16 App Router — read `AGENTS.md` before writing Next.js code.
- **Preserve behaviour.** This is a visual sweep; no functional changes, no
  refactors beyond swapping in shared components. The workspaces tree in
  particular has drag-and-drop, folder cycles and a `--ws-accent` CSS variable
  mechanism — leave all of that working exactly as it is.

## Your files (exclusive)

- `app/components/widgets/people/**`
- `app/components/widgets/habits/**`
- `app/components/widgets/daily-goals/**`
- `app/components/widgets/braindump/**`
- `app/components/widgets/workspaces/**`
- `lib/ui/pagination.ts` + colocated test (new -- see below)

## What to do

### The two reference patterns

1. **`app/components/widgets/people/InstagramFollowsCard.tsx`** — DESIGN.md §4.8
   was written from this screen. Apply it properly: `label-caps` uppercase
   header on `surface-container-lowest` with a bottom hairline; transparent body
   rows with `hover:bg-surface-container/60` and `py-3 px-4` cells; a `group`
   class so row-hover reveals the open-in-new affordance; 36px `rounded-full`
   initial avatars tinted with the accent at 20–30% to encode row category;
   `bg-surface-container-lowest/40` for selected rows; a
   `rounded-xl bg-surface-container-high` bulk-action strip; pagination with the
   current page inverted to `bg-primary-container text-on-primary-container`.
   Use `EntityChip` for the linked-person chip and the dashed-placeholder button
   variant for the unlinked slot.

2. **The Workspaces thinking log** — DESIGN.md §4.9 was written from this
   screen. Apply it via P0's timeline-entry component: a 12px accent dot at
   `absolute left-2.5 top-3.5` with content at `pl-10`; each entry a nested
   `surface-container` card at `rounded-xl p-4`; a kind pill left and a
   `label-caps text-outline` timestamp right; body in `body-md` with
   `leading-relaxed`; a footer line of `#tags` tinted `secondary-fixed-dim`.
   The workspace stat rings are a `StatTile` fit.

Wave 1 did **not** build a pagination component, though §4.8 describes one. Build
the page-window logic as pure functions in `lib/ui/pagination.ts` with a
colocated `.test.ts` (the repo convention for pure logic), and render it in the
Instagram table.

### Everywhere else

3. Replace hand-rolled pills/chips/filters with `StatusBadge`, `CountBadge`,
   `MetadataChip`, `EntityChip`, `FilterTabs`, `StatTile`.
4. Apply DESIGN.md §4.2 to cards: `surface-container-low` fill, 1px
   `outline-variant` border, `rounded-xl`, 24px padding for full cards and
   16–20px for nested ones; a nested card climbs exactly one surface step.
5. Clear stray literals — `shadow-black/*`, hex in `className`, any leftover
   `neutral-*`/`gray-*`/`dark:`.
6. **Leave alone:** the hardcoded hex array in
   `app/components/widgets/habits/HabitFormModal.tsx` is **user-facing
   colour-swatch palette data, not theme drift.** Do not tokenise it.

Respect the per-workspace `--ws-accent` variable: components inside a workspace
must keep deriving their accent from it rather than taking a hardcoded one, and
`Popover`/`InfoPopover` must stay in-place rather than portalled so the variable
still applies.

## Verify before reporting done

Run `npx tsc --noEmit`, `npm run lint` and `npm test`. All three must pass.
Then `npm run dev` and spot-check `/people`, `/habits`, `/workspaces` and a
workspace detail page at 1440px+ against DESIGN.md §4. Confirm drag-and-drop in
the workspaces tree still works and per-workspace colours still apply.

## Report back

Which files you changed and what you swapped in each; how closely you were able
to hit §4.8 and §4.9; anything you judged already correct and left alone;
anything outside your scope that needs a change; and anything you could not do.
