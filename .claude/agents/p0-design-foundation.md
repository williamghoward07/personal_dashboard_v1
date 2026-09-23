---
name: p0-design-foundation
description: Wave 1. Reskins the three legacy glinui primitives and builds the shared BIO-SYSTEM components that DESIGN.md describes but the repo lacks. Every later phase consumes its output.
model: opus
effort: high
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are implementing **Phase P0** of an approved plan in the Study Copilot repo
(`C:\Users\William\Projects\personal-dashboard-v1`). Read the full plan at
`C:\Users\William\.claude\plans\vectorized-frolicking-russell.md` first.

Yours is the highest-leverage task in the batch: six other agents will copy the
components you build. Get the APIs right.

## Hard rules

- **Only edit the files listed under "Your files".** Other agents are editing
  other files in parallel right now. If something outside your scope must
  change, STOP and report it — do not edit it.
- `DESIGN.md` at the repo root is the single source of truth for visual design.
  Never hardcode a colour, font or spacing value; use the `@theme inline` tokens
  in `app/globals.css` and the accent maps in `lib/theme.ts`.
- Next.js 16 App Router, with breaking changes from what you may remember. Read
  `AGENTS.md` and consult `node_modules/next/dist/docs/` before writing Next.js
  code.
- Tailwind v4, CSS-first — there is **no** `tailwind.config.*`. JIT cannot see
  computed class names; dynamic classes must come from a static lookup table
  (see `COLUMN_GRID_CLASS` in `lib/workspaces/layout.ts`).
- Icons are `lucide-react`. Never introduce a second icon set — in particular,
  DESIGN.md's mockups use Material Symbols; translate those to lucide.
- Read `CLAUDE.md` for project conventions.

## Your files (exclusive)

- `app/globals.css`
- `lib/theme.ts`
- `components/ui/**`
- `app/components/WidgetCard.tsx`
- `app/design-system-test/page.tsx`

## What to do

### 1. Reskin the three legacy primitives

`components/ui/button.tsx`, `input.tsx` and `progress.tsx` are glinui output
that was generated and never reskinned. They are the only real legacy styling
left in the codebase. Strip every `neutral-*`, `dark:` variant and raw
white/black or `rgb(...)` literal, and rebuild them against the tokens.

- `button.tsx` → DESIGN.md §4.4. The seven variants there are: primary,
  secondary, tertiary/quiet, icon, destructive, ghost accent, dashed
  placeholder. Map the existing CVA variant names onto these rather than
  inventing a parallel set, and keep the component's current external API so
  the six files that already import `Button` keep compiling.
- `input.tsx` → DESIGN.md §4.6. Focus is a border-colour change to the accent
  plus the optional Cyber Glow; `focus:outline-none` throughout, never a
  browser ring.
- `progress.tsx` → DESIGN.md §4.7. Its `default` variant is already
  token-driven; the `glass`/`liquid`/`matte` variants are legacy. Only
  `progress-ring.tsx` consumes this and it forces `variant="default"`, so you
  may delete the dead legacy variants outright — check with grep first.

`glass-card.tsx`, `module-glass-card.tsx` and `progress-ring.tsx` are already
token-clean. Leave them unless DESIGN.md demands a change.

### 2. Fill token gaps

Audit `app/globals.css` against DESIGN.md §2, §3 and §5.3 and add only what is
missing. Known gaps to check:

- Spacing steps §5.3 names: `card-gap` (20px) and `container-padding` (24px).
- Type-scale steps: `body-lg`, `body-md`, `body-sm`, `headline-lg-mobile` —
  confirm which already exist as `--text-*` tokens before adding.
- The radius ramp in §4.1 (4px / 8px / 12px / full) **already matches Tailwind
  v4's defaults**. Verify this and leave it alone if so — do not redefine it.

Do not remove or rename existing tokens; widgets across ~166 files depend on
them.

### 3. Build the missing shared components

DESIGN.md describes these; the repo has no equivalent. Build them in
`components/ui/`, accent-aware via `lib/theme.ts` (`Accent`, `ACCENT_*` maps):

- `StatusBadge` — §4.5 strong badge: pill, accent at 15% bg, 1px accent border,
  `label-caps`, optional leading dot with `pulse` / `ping` states.
- `CountBadge` — §4.5, pill on `surface-container-highest`, accent text.
- `MetadataChip` — §4.5, `rounded` (4px) on `surface-container-highest`.
- `EntityChip` — §4.5, pill with a 16px avatar and a close button that turns
  `error` on hover.
- `FilterTabs` — §4.10 segmented control. **Check `app/components/LiquidSwitch.tsx`
  first** — if it already does this, extend or re-export it rather than
  duplicating. Report which you chose.
- `StatTile` — §4.7: a 64px `ProgressRing` (reuse the existing one) beside a
  `data-display` value and a `label-caps` caption.
- Table-row helpers for §4.8 and a timeline-entry component for §4.9. Keep
  these compositional (header/row/cell, or an entry that takes a kind pill,
  timestamp, body and tags) — Wave 3 agents will apply them to real data.

Export everything from a single barrel if that fits the existing convention;
check how `components/ui` is currently imported before deciding.

### 4. Prove it

Extend `app/design-system-test/page.tsx` to render every component above in
every variant and accent. This page is the visual verification surface for the
whole batch — make it genuinely complete and readable.

## Verify before reporting done

Run `npx tsc --noEmit`, `npm run lint` and `npm test`. All three must pass.
Report any failure you could not fix rather than hiding it.

## Report back

What you changed; the API of each new component (name + props), since other
agents need it; any decision the plan left open that you made (especially the
`FilterTabs`/`LiquidSwitch` call and whether you deleted `progress.tsx`'s legacy
variants); and anything you could not do.
