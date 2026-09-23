# Wave 1 handoff — what P0 and P1 built

Read this before starting any Wave 2 or Wave 3 phase. It is the API contract the
rest of the batch builds against. Verified state at handoff: `npx tsc --noEmit`
clean, `npm test` 375/375 passing.

## Conventions you must follow

- **Prefer the `@utility` type classes over the `text-*` spellings.** P0 added
  nine utilities in `app/globals.css` — `data-display`, `headline-xl`,
  `headline-lg`, `headline-lg-mobile`, `headline-md`, `body-lg`, `body-md`,
  `body-sm`, `label-caps`. Write `className="label-caps"`, not
  `className="text-label-caps"`. The utilities also carry the correct font
  family, which a bare `--text-*` token cannot. The old `text-*` spellings still
  work and are now safe in `cn()` (see below), so do not churn existing call
  sites just to change the spelling.
- **`lib/utils/cn.ts` has been fixed.** It previously dropped custom type sizes:
  `cn('text-headline-lg', 'text-on-surface')` returned only `text-on-surface`.
  The type scale is now registered in tailwind-merge's `font-size` group, with
  regression tests in `lib/utils/cn.test.ts`. If you add a new `--text-*` token
  you must add it to `TYPE_SCALE` in that file.
- **No barrel file.** Import each component from its own path, e.g.
  `import { StatusBadge } from '@/components/ui/status-badge'`. All 50 existing
  call sites do this.
- **Lint baseline is 38 problems / 36 errors on a clean tree**, all
  `react-hooks/set-state-in-effect` in files nobody in this batch owns. "Lint
  clean" means *you add no new problems*, not that the repo reports zero. Verify
  by linting only your own files.
- **Spacing utilities now exist** per DESIGN.md §5.3: `gap-card-gap` (20px),
  `p-container-padding` (24px), plus `unit`, `gutter`, `margin-mobile`,
  `margin-desktop`.
- **Radius:** Tailwind v4's defaults already match DESIGN.md §4.1. Use
  `rounded-sm` (4px), `rounded-lg` (8px), `rounded-xl` (12px), `rounded-full`.
  Bare `rounded` is deprecated in v4 — don't use it in new code.

## `lib/theme.ts`

`UiAccent = Accent | 'ws'` is new. `'ws'` follows the page's `--ws-accent`
variable, so a shared component inside a workspace picks up that workspace's
colour with no prop threading. All accent maps are `Record<UiAccent, string>`.

New maps: `ACCENT_BADGE` (§4.5 strong badge), `ACCENT_SOFT` (§4.8 avatar tint,
§4.9 kind pill), `ACCENT_SOLID` (§4.10 active tab), `ACCENT_BORDER`,
`ACCENT_GHOST` (§4.4 ghost accent), `ACCENT_FOCUS` (§4.6). Plus
`ACCENTS: readonly Accent[]` in palette order.

## Components (all in `components/ui/`)

```ts
// button.tsx
variant?: 'default'|'secondary'|'outline'|'quiet'|'ghost'|'icon'|'destructive'|'accent'|'dashed'
size?: 'sm'|'md'|'lg'|'icon'|'icon-sm'   accent?: UiAccent   asChild?: boolean
// §4.4: Primary→default, Secondary→secondary/outline, Tertiary→quiet/ghost,
// Icon→icon+size="icon", Destructive→destructive, Ghost accent→accent, Dashed→dashed

// input.tsx
variant?: 'default'|'card'|'outline'|'ghost'   size?: 'sm'|'md'|'lg'   accent?: UiAccent
// card = rounded-xl in-card; ghost = inline-editable cell.
// Leading icon: wrap in `relative`, place icon at left-3, pass className="pl-9"

// progress.tsx — `variant` prop REMOVED; CircularProgress alias REMOVED
Progress:       { value?, size?: 'sm'|'md'|'lg', indeterminate? }
ProgressCircle: { value?, size?, strokeWidth?, cap?, indeterminate?, showValue?, formatValue? }

// progress-ring.tsx
ProgressRing: ProgressCircleProps & { accent?: UiAccent }

// status-badge.tsx (§4.5)
{ accent?: UiAccent; dot?: boolean|'static'|'pulse'|'ping'; icon?: ReactNode; size?: 'sm'|'md' }

// count-badge.tsx (§4.5)
{ count: number; accent?: UiAccent; max?: number }

// metadata-chip.tsx (§4.5)
{ accent?: UiAccent; icon?: ReactNode }

// entity-chip.tsx (§4.5)
{ name: string; accent?: UiAccent; avatar?: ReactNode; onRemove?: () => void; removeLabel?: string }

// filter-tabs.tsx (§4.10) — generic function component, no ref
FilterTabOption<T> = { value: T; label: ReactNode; count?: number; icon?: ReactNode }
FilterTabs<T extends string>: { options, value, onChange, accent?, size?: 'md'|'compact', className?, 'aria-label'? }

// stat-tile.tsx (§4.7)
{ label, value, unit?, detail?, percent?, accent?, icon?, ringTitle?,
  size?: 'md'|'lg', variant?: 'card'|'bare' }
// Prop names deliberately match WorkspaceStatCards.tsx's private StatCard.

// data-table.tsx (§4.8) — compositional
DataTable, DataTableHead, DataTableHeaderCell{align?}, DataTableBody,
DataTableRow{selected?}, DataTableCell{align?}, DataTableRowActions,
DataTableBulkBar, DataTableAvatar{name?, accent?}

// timeline.tsx (§4.9)
Timeline (ol)
TimelineEntry: { accent?, kind?, kindIcon?, timestamp?, dateTime?, tags?,
                 activeTag?, onTagClick?, footnote?, children }
```

`app/components/WidgetCard.tsx`: `title` widened to `ReactNode`, `accent` to
`UiAccent`, padding now `p-container-padding`.

**`/design-system-test` renders every component in every variant and accent.**
Read that page before building anything — it is faster than reading the sources.

## `lib/settings/` (P1)

```ts
// schema.ts — pure, no React
type HomeWidgetSpan = 1|2|3|4
interface HomeLayoutEntry { id: string; span: HomeWidgetSpan; hidden: boolean }
interface UserSettings {
  home_layout: HomeLayoutEntry[]
  hidden_nav_items: string[]
  launcher_link_ids: string[]
}
defaultSettings(): UserSettings
clampSpan(span: unknown): HomeWidgetSpan
parseHomeLayout(raw: unknown): HomeLayoutEntry[]
parseUserSettings(row): UserSettings
mergeHomeLayout(stored, knownIds): HomeLayoutEntry[]   // P3's entry point

// use-settings.ts
useSettings(): {
  settings: UserSettings      // always fully defaulted, never null
  loading: boolean
  error: string | null        // only ever set by a failed write
  refresh: () => void
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>
}
```

- `settings` returns defaults silently when the row is missing, the table does
  not exist (the migration is applied by hand and **may not be applied yet**),
  or any read fails. Build for that — it is the normal first-run state.
- `updateSettings` is optimistic with rollback on failure.
- `hidden_nav_items` and `launcher_link_ids` are plain arrays with no helper
  functions; read and write them directly through `updateSettings`.
- Migration: `supabase/migrations/20260920000000_user_settings.sql`.

## Known gaps left for later phases

- **No pagination component**, though DESIGN.md §4.8 describes one. Assigned to
  **P5c**: put the windowing logic in `lib/ui/pagination.ts` with a colocated
  test, per the repo's pure-logic convention.
- `app/glinui-test/page.tsx` is now redundant with `/design-system-test`.
  Flagged for William; nobody should delete it unilaterally.
- `FilterTabs` and `app/components/LiquidSwitch.tsx` are deliberately separate —
  LiquidSwitch is the AI query bar's sliding glass mode switch, FilterTabs is
  §4.10's invert-the-active-tab control. Their prop signatures match, so they
  can be merged later if wanted.
