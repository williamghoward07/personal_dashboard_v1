---
name: p2-shell-frame
description: Wave 2. Adopts the DESIGN.md section 5.1 shell frame, replaces the hardcoded top-bar title with a contextual breadcrumb plus per-route browser tab titles, and adds the settings menu with navbar tab show/hide.
model: opus
effort: high
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are implementing **Phase P2** of an approved plan in the Study Copilot repo
(`C:\Users\William\Projects\personal-dashboard-v1`). Read the full plan at
`C:\Users\William\.claude\plans\vectorized-frolicking-russell.md` first.

You own the app shell — every page in the app renders inside what you build.
This phase merges three of the user's goals: the §5.1 frame, contextual titles,
and navbar tab visibility.

## Prerequisites already landed

- **P0** reskinned `components/ui/{button,input,progress}.tsx` and added shared
  components (`StatusBadge`, `CountBadge`, `MetadataChip`, `EntityChip`,
  `FilterTabs`, `StatTile`, table/timeline helpers). Read
  `app/design-system-test/page.tsx` to see what exists, and **use those
  components** rather than hand-rolling pills or chips.
- **P1** created `lib/settings/` — `schema.ts` (types, defaults, tolerant
  merge) and `use-settings.ts` (optimistic write, falls back to defaults if the
  table is missing). Read both before you start. `hidden_nav_items` is your
  field.

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
- Next.js 16 App Router with breaking changes. Read `AGENTS.md` and consult
  `node_modules/next/dist/docs/` before writing Next.js code — metadata and
  title handling in particular.
- Icons are `lucide-react`. DESIGN.md's mockups use Material Symbols; translate
  them to lucide equivalents, never add a second icon set.
- Read `CLAUDE.md` for project conventions.

## Your files (exclusive)

- `app/layout.tsx`
- `app/components/AppChrome.tsx`
- `app/components/Sidebar.tsx`
- `app/components/TopAppBar.tsx`
- `app/components/MobileBottomNav.tsx`
- `lib/nav-items.ts`
- `lib/page-title.ts` (new)
- `app/components/settings/**` (new directory)

## What to do

### 1. Adopt the DESIGN.md §5.1 frame

The shell is already structurally close: `Sidebar.tsx` is a `w-20` fixed-left
rail and `TopAppBar.tsx` is `h-16`. This is a reskin plus new content, not a
rebuild.

- **Rail:** 40px logo tile at the top, 48px `rounded-xl` nav targets with
  `gap-3`, and the pinned footer group — a quick-add button, a 1px divider, and
  a pulsing accent "system live" dot. Active item inverts to
  `bg-primary-container text-on-primary-container`.
- **Top bar:** keep `bg-surface-container-lowest/90` with `backdrop-blur-xl` and
  the bottom hairline. Left gets the breadcrumb (below). Add the live
  integration status pills using P0's `StatusBadge` — drive them from **real**
  connection state (Starling, Google, Microsoft), not placeholder text. Check
  how existing code reads the `integrations` table before inventing a source.
- **Do not** add the mockup's top-bar command input. `AiQueryBar` already owns
  that job on the home page; duplicating it would split the app's central
  feature. This is a deliberate exclusion from the plan.
- `TopAppBar` auto-hides on scroll-down via `useScrollDirection()`. Keep that
  working, and make sure the new settings button stays reachable.

### 2. Contextual titles — both surfaces

Today `"STUDY COPILOT"` is a hardcoded JSX string at `TopAppBar.tsx:53`, and the
browser tab title is a separate static `metadata.title` at `app/layout.tsx:22`.
No route sets its own metadata and `document.title` is never set anywhere.

Build `lib/page-title.ts`: a React context plus a `usePageTitle(...)` publisher
and a `useDocumentTitle` effect, so a page publishes its context **once** and
both surfaces consume it:

- The top-bar breadcrumb renders `BIO-SYSTEM v1.0 / <MODULE> // <CONTEXT>` in
  `label-caps`, per DESIGN.md §5.1.
- The browser tab reads `<context> — Study Copilot`.
- Default, when a route publishes nothing: derive `<MODULE>` from the matching
  `navItems` entry's label. Never fall back to a bare "Study Copilot" in the
  breadcrumb.

Wire `/workspaces/[id]` as the reference implementation so the workspace name
appears in both places — that is the user's stated example. Note that every page
in this app is client-rendered under one root layout, so a client context is the
right mechanism; confirm against the Next.js 16 docs before committing to it.

Publishing the title from `app/workspaces/[id]/page.tsx` or its board component
would put you outside your file scope. Instead, expose the hook and report to me
which single file needs the one-line call; I will make that edit or assign it.

### 3. Settings menu and navbar tab visibility

- Add a settings icon button to the top bar's right group, between the
  fullscreen toggle and sign-out. Reuse the existing icon-button class string
  already on those two buttons (`TopAppBar.tsx:70`) so it matches exactly.
- It opens a settings panel in `app/components/settings/`. Use the existing
  `Popover` or `Modal` from `app/components/` — do not build a third overlay
  primitive. Note the `CLAUDE.md` guidance that `Popover` is deliberately
  in-place, not portalled.
- The panel lists every nav item with a visibility toggle, writing
  `hidden_nav_items` through P1's `use-settings.ts`.
- Add a shared `useVisibleNavItems()` selector and have **both** `Sidebar.tsx`
  and `MobileBottomNav.tsx` consume it. They currently each import and iterate
  `navItems` independently — that duplication is why this selector exists.
- `/todos` and `/ai-usage` are real routes with no nav entry today. Add them to
  `navItems` as available-but-hidden-by-default so they can be switched on.
- Home must not be hideable, or the user can strand themselves. Guard it.

## Verify before reporting done

Run `npx tsc --noEmit`, `npm run lint` and `npm test`. All three must pass.
Then `npm run dev` and check at 1440px+: the breadcrumb shows the right module
per route, the browser tab title changes, toggling a nav tab hides it in both
the rail and the mobile bar, and the change survives a reload.

## Report back

What you changed; which single file outside your scope needs the
`usePageTitle` call for `/workspaces/[id]`; any decision the plan left open that
you made; and anything you could not do.
