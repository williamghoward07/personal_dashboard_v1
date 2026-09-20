# Design System: Aura Performance Dashboard ("BIO-SYSTEM")

**Source:** Stitch project `projects/9224592078770144572` — *Aura Performance Dashboard*
**Derived from:** all six generated screens — Main Dashboard, AI Command Center,
Performance & Finance Metrics, Academic & Research Hub,
**Workspaces // Coastal Erosion Essay**, and **Instagram Follows // People CRM**.

This document describes the **design language of the Stitch mockups**. It is the
visual reference the app's BIO-SYSTEM theme is built from; where the shipped code
deliberately diverges, that is recorded in §7.

---

## 1. Visual Theme & Atmosphere

**Dark-only, techno-minimalist mission control.** The mood is analytical,
high-focus and "always on" — closer to an instrument panel or an elite wearable's
companion app than to a productivity SaaS tool. It is committed dark: there is no
light variant anywhere in the six screens.

Three ideas carry the whole aesthetic:

- **Near-black green-tinted ground.** The base is not neutral grey but a deep
  charcoal with a green cast (`#0c150f`), so mint accents read as *emitted* light
  rather than painted colour.
- **Bento modularity.** Every screen is a 12-column grid of self-contained,
  varying-width cards. No module dominates; visual weight is balanced by density,
  not by size.
- **Colour as signal, never decoration.** The interface is 95% monochrome. A hue
  appearing at all means something: a module identity, a status, or a live feed.

The density is **high but breathable** — a lot of numbers per screen, kept legible
by generous internal card padding (24px) and a disciplined 4px vertical rhythm.
Motion is constant but tiny: pulsing status dots, `animate-ping` on live feeds,
a slow scanline gradient over the AI panel. The effect is "instrument humming,"
not "page animating."

---

## 2. Colour Palette & Roles

### 2.1 Surface scale — Deep Forest Charcoal

A nine-step ladder from near-black to a lifted slate-green. Depth is expressed by
*climbing this ladder*, not by shadow.

| Token | Hex | Description & role |
| --- | --- | --- |
| `surface-container-lowest` | `#07100a` | **Abyssal Green-Black.** The rail, the fixed header, footers — the chrome that sits *behind* content. |
| `background` / `surface` / `surface-dim` | `#0c150f` | **Deep Forest Charcoal.** The page ground behind every card. |
| `surface-container-low` | `#141e17` | **Raised Moss.** The default bento-card fill. Most cards are this. |
| `surface-container` | `#18221b` | **Nested Moss.** Cards *inside* cards — source cards, task rows, log entries. |
| `surface-container-high` | `#232c25` | **Interactive Slate.** Inputs, icon buttons, secondary buttons, inline chips. |
| `surface-container-highest` | `#2d3730` | **Pressed Slate.** Hover/active of the above; count badges; progress-ring tracks. |
| `surface-bright` | `#323c34` | **Lifted Slate.** The brightest hover state, reserved for small controls. |
| `outline-variant` | `#3b4a3f` | **Hairline Sage.** The 1px border on nearly everything. Structure, not emphasis. |
| `outline` | `#849587` | **Muted Sage.** Tertiary text, placeholders, disabled icons, separators. |

### 2.2 Foreground text

| Token | Hex | Description & role |
| --- | --- | --- |
| `primary` | `#f4fff3` | **Near-White Mint Tint.** Headings, key values, primary row text. The brightest thing on screen that isn't an accent. |
| `on-surface` | `#dae5da` | **Pale Sage White.** Default body copy. |
| `on-surface-variant` | `#b9cbbc` | **Dimmed Sage.** Supporting copy, labels, inactive nav. |
| `outline` | `#849587` | **Muted Sage.** Metadata, timestamps, "354 unlinked waiting for triage." |

### 2.3 Functional accents

Each accent has a **container** (the vivid, saturated signal colour) and a
**fixed-dim** (a softer form for text on dark, where full saturation would glare).

| Token | Hex | Description & role |
| --- | --- | --- |
| `primary-container` | `#00ff9d` | **Electric Mint.** The system's signature. Primary CTAs, active nav, "System Nominal", linked/success states, Health metrics. |
| `primary-fixed-dim` | `#00e38b` | **Softened Mint.** Mint used as *text* on dark (e.g. "128 linked"). |
| `primary-fixed` | `#56ffa8` | **Pale Mint.** Hover state of a solid mint button. |
| `secondary-container` | `#14d1ff` | **Electric Cyan-Blue.** Money/finance, secondary actions, AI suggestions. |
| `secondary` | `#a6e6ff` | **Ice Blue.** Blue used as body text; the AI input's focus glow. |
| `secondary-fixed-dim` | `#4cd6ff` | **Sky Cyan.** Inline metadata links — source domains, module subtitles. |
| `tertiary-fixed-dim` | `#ffb77f` | **Warm Apricot.** "Needs attention" without alarm — unlinked Instagram rows, pending triage, Strava Live. |
| `tertiary-container` | `#ffd8bd` | **Pale Peach.** Low-opacity avatar fills for warm-tagged rows. |
| `error` | `#ffb4ab` | **Soft Coral.** Destructive text and hover states (unlink, archive). |
| `error-container` | `#93000a` | **Deep Oxblood.** Background for a destructive hover (Archive button). |

### 2.4 Module-identity accents

Two of these appear as literal Tailwind tokens in the Academic & Research Hub
screen; the rest are extrapolated into `lib/theme.ts` in the app.

| Token | Hex | Module |
| --- | --- | --- |
| `academic-orange` | `#FF6B00` | **Signal Orange.** Education, deadlines, the home query box. |
| `research-pink` | `#FF007F` | **Hot Magenta.** Research and deep-work. |
| `primary-container` | `#00ff9d` | Mint — Health. |
| `secondary-container` | `#14d1ff` | Electric blue — Money. |
| *(app-only, see §7)* | `#c084fc` / `#ffc233` / `#ff3b3b` / `#2dd4bf` | Purple Habits · Amber People · Crimson Bible · Teal Workspaces. |

### 2.5 The legacy neutral greys

Three screens (Main Dashboard, AI Command Center, Academic Hub) hard-code an
older **pure-neutral** card recipe in inline CSS: `#1A1A1A → #121212` gradient on
a `#333333` border, over a `#0A0A0A` ground. The Metrics screen supersedes this
with the green-tinted token equivalent.

> **Use the token version.** `surface-container-low` on `outline-variant` over
> `background` is the canonical card. The `#1A1A1A`/`#333333` values are a
> historical artifact of earlier generations and should not be introduced into
> new work.

---

## 3. Typography Rules

Two families, split strictly by job.

- **Geist** — every heading, every label, every number. Its near-monospaced digit
  widths make tabular data sit still. Tight, negative letter-spacing at large
  sizes gives headlines and metrics a compressed, engineered feel.
- **Inter** — all body and descriptive copy. Neutral, highly legible at 14px.

| Style | Family | Size / line-height | Weight | Tracking | Used for |
| --- | --- | --- | --- | --- | --- |
| `data-display` | Geist | 48 / 48 | 700 | **−0.04em** | Hero metrics. The tightest tracking in the system — numbers read as one solid block. |
| `headline-xl` | Geist | 40 / 48 | 700 | −0.02em | Page titles ("Instagram Follows Network"). |
| `headline-lg` | Geist | 32 / 40 | 600 | −0.01em | Card-level stat values (`482`, `94.2 IDX`). |
| `headline-lg-mobile` | Geist | 24 / 32 | 600 | — | The `headline-xl` substitute below `md`. |
| `headline-md` | Geist | 20 / 28 | 600 | — | Section headings ("Scoped Sources"). Also used at `text-body-sm` for *emphasised* row text — the family, not the size, carries the weight. |
| `body-lg` | Inter | 18 / 28 | 400 | — | Lead paragraphs. Rare. |
| `body-md` | Inter | 16 / 24 | 400 | — | Default body; thinking-log entries use it with `leading-relaxed`. |
| `body-sm` | Inter | 14 / 20 | 400 | — | The workhorse: table cells, descriptions, inputs. |
| `label-caps` | Geist | 12 / 16 | 700 | **+0.08em** | UPPERCASE metadata, status pills, filter tabs, column headers. The system's most distinctive voice. |

**Two rules worth naming explicitly:**

1. **`label-caps` is always uppercase and always wide.** The `+0.08em` tracking
   against `data-display`'s `−0.04em` is the typographic signature of the whole
   system — squeezed numbers, stretched labels.
2. **Below 12px, drop to raw `text-xs`/`text-[11px]` in Geist rather than shrinking
   `label-caps`.** The screens do this for timestamps and tiny avatar initials.

---

## 4. Component Stylings

### 4.1 Shape language — "Modular-Soft"

Only four radii are in play, and each maps to a role:

| Radius | Value | Description | Applied to |
| --- | --- | --- | --- |
| `rounded` (DEFAULT) | 0.25rem / 4px | **Barely softened.** | Inline micro-chips, checkboxes, count badges. |
| `rounded-lg` | 0.5rem / 8px | **Gently curved.** | Buttons, inputs, icon tiles, table-row action buttons. |
| `rounded-xl` | 0.75rem / 12px | **Distinctly rounded.** | The standard bento card and every nested card. |
| `rounded-full` | 9999px | **Pill / circle.** | Status badges, avatars, filter pills, live dots. |

`rounded-full` is the single most-used radius in the system (121 uses across six
screens) — status is *always* a pill, identity is *always* a circle.

### 4.2 Cards & containers

The canonical bento card:

```
bg-surface-container-low  rounded-xl  p-6  border border-outline-variant
```

- **Fill:** `surface-container-low` (`#141e17`), optionally as a 135° gradient down
  to `surface-container-lowest` (`#07100a`) for large hero cards.
- **Border:** always present, always 1px, always `outline-variant` (`#3b4a3f`).
  A card without a border does not exist in this system.
- **Padding:** 24px (`p-6`) for full cards, 16–20px (`p-4`/`p-5`) for nested cards
  and stat tiles.
- **Nesting:** a card inside a card climbs exactly one step — `surface-container`
  (`#18221b`) — and keeps `rounded-xl`. Hover lifts it one further step to
  `surface-container-high`.
- **Card footers** are made by bleeding a strip of `surface-container-low/50` to the
  card edges (`-mx-4 -mb-4 px-4 py-2.5 rounded-b-xl`) — an inset tray, not a divider.
- **Glass variant** (modals, the AI query bar, overlay panels):
  `rgba(34,34,34,0.5–0.6)` with `backdrop-filter: blur(20px)` and the same 1px border.

### 4.3 Depth & elevation

Depth is **luminosity and border contrast, not shadow.** There are no traditional
drop shadows in the palette; `shadow-md`/`shadow-lg` appear only as faint ambient
separation, never as a visible lip.

The one real elevation effect is the **Cyber Glow**:

```css
box-shadow: 0 0 15px rgba(<accent>, 0.2);
border-color: <accent>;
```

Applied on **hover** for interactive cards and on **focus** for inputs, always in
the *module's own accent* — mint on Health, blue on Money, orange on Education,
pink on Research. A glow means "this responds to you," never "this is important."

Two supporting effects:

- **Ambient bloom.** A large blurred accent orb at 5% opacity tucked behind a hero
  card's corner: `absolute -right-16 -top-16 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl`.
- **Scanline.** A slow vertical gradient sweep at 5% mint over the AI panel.

### 4.4 Buttons

| Variant | Recipe | Use |
| --- | --- | --- |
| **Primary** | `bg-primary-container text-on-primary-container` (mint fill, dark green text), `rounded-lg`, `px-4 py-2.5`, Geist semibold/bold, `shadow-lg shadow-primary-container/20`, hover → `bg-primary-fixed` | One per screen. "Launch Working Set", "Import Instagram Export". |
| **Secondary** | `bg-surface-container-high text-on-surface`, `rounded-lg`, hover → `bg-surface-bright` | "Add Source", "Export CSV". Usually with a leading accent-coloured icon. |
| **Tertiary / quiet** | `bg-surface-container-lowest text-outline`, hover → `bg-surface-container text-on-surface-variant` | "Archived Workspaces", pagination arrows. |
| **Icon button** | 32–36px square (`w-8 h-8`/`w-9 h-9`), `rounded-lg`, `bg-surface-container-high`, `border-outline-variant`, `text-on-surface-variant` → `text-on-surface` on hover | Settings, overflow menu, rail actions. |
| **Destructive** | `text-outline` at rest; hover → `bg-error-container text-error` | Archive, unlink. Never red at rest. |
| **Ghost accent** | `bg-<accent>/10 border border-<accent>/30 text-<accent>`, hover → `bg-<accent>/20` | AI suggestions, "Suggest Person" in the Instagram table. |
| **Dashed placeholder** | `border border-dashed border-tertiary-fixed-dim/40 text-tertiary-fixed-dim` | Unfilled slots — "Link to CRM person". Dashed = *nothing here yet*. |

Buttons carrying an icon pair it at `text-[16px]`–`text-[20px]` with `gap-1.5`–`gap-2`.
Micro-interaction on tappable tiles: `scale-95 active:scale-90`.

### 4.5 Status badges & chips

The single most repeated component. Always a pill.

- **Status badge (strong):** `rounded-full px-3 py-1`, accent at **15% background**,
  **1px solid accent border**, accent text, `label-caps`. Often with a 6px leading
  dot (`w-1.5 h-1.5 rounded-full bg-<accent>`); `animate-pulse` when live,
  `animate-ping` when streaming.
- **Count badge:** `rounded-full px-2 py-0.5 bg-surface-container-highest`, accent
  text, `label-caps` bold. Sits immediately after a section heading.
- **Metadata chip:** `rounded px-2 py-0.5 bg-surface-container-highest`, accent text,
  `label-caps`. Used in the workspace meta line — "6 Sources", "4 Scoped Actions".
- **Entity chip (linked record):** `rounded-full px-3 py-1.5 bg-surface-container-high`
  with a **30%-opacity accent border**, a 16px circular avatar, the name in `primary`,
  and a small close button that turns `error` on hover.

### 4.6 Inputs & forms

```
h-9 / h-10   bg-surface-container-high   border border-outline-variant
rounded-lg (chrome) | rounded-xl (in-card)   text-body-sm   placeholder:text-outline
focus:outline-none focus:border-primary-container
```

- **Focus is a border-colour change to the module accent**, optionally with the
  Cyber Glow. Never a default browser ring; `focus:outline-none` is universal.
- **Leading icon** absolutely positioned at `left-3`/`left-3.5`, `text-outline`,
  18px; input padded `pl-9`/`pl-10` to clear it.
- **Inline editable cell** (Instagram display-name column): transparent at rest,
  `hover:bg-surface-container`, `focus:bg-surface-container` — the field only
  announces itself when approached.
- **Select:** same recipe as text input, `rounded-xl px-3 py-2`.
- **Checkbox:** `rounded` (4px), `bg-surface-container-lowest`,
  `border-outline-variant`, `text-primary-container` when checked, `focus:ring-0`.
- **Submit affordance** inside a field: a 24px `rounded` button at `right-2`,
  accent-coloured, holding an enter-arrow icon.

### 4.7 Progress rings

64px (`w-16 h-16`) inline SVG, `viewBox="0 0 36 36"`, rotated `-90°`:

- Track path in `surface-container-highest`, `stroke-width="3"`.
- Value path in the module accent, `stroke-width="3"`, `stroke-linecap="round"`,
  progress via `stroke-dasharray="<pct>, 100"`.
- A 20px icon centred absolutely inside, in the same accent.

Paired with a `data-display` number and a `label-caps` caption to form a stat tile.

### 4.8 Data tables (Instagram Follows pattern)

- **Header row:** `label-caps` uppercase in `on-surface-variant`, sitting on
  `surface-container-lowest`, with a `border-b border-outline-variant`.
- **Body rows:** transparent, `hover:bg-surface-container/60 transition-colors`,
  `py-3 px-4` cells, and a `group` class so row-hover reveals per-row affordances
  (`opacity-0 group-hover:opacity-100` on the open-in-new icon).
- **Row state by avatar tint:** a 36px `rounded-full` initial-avatar whose fill is
  the accent at 20–30% opacity encodes the row's category at a glance.
- **Selected-row emphasis:** a faint `bg-surface-container-lowest/40` wash.
- **Bulk-action bar:** appears as a `rounded-xl bg-surface-container-high` strip
  above the table when any row is checked.
- **Pagination:** `rounded-lg` number buttons; current page inverted to
  `bg-primary-container text-on-primary-container`; disabled arrows at
  `opacity-30 cursor-not-allowed`.

### 4.9 Timeline / thinking log (Workspaces pattern)

An append-only vertical feed:

- A 12px accent dot (`rounded-full`, `shadow-sm shadow-<accent>`) pinned at
  `absolute left-2.5 top-3.5`, with content pushed to `pl-10`.
- Each entry is a nested `surface-container` card, `rounded-xl p-4`.
- Header row: a **kind pill** (accent at 20–30%, `label-caps` bold, `rounded-full`)
  on the left, a `label-caps text-outline` timestamp on the right.
- Body in `body-md` with `leading-relaxed` — the one place the system relaxes.
- A footer line of `#tags` in `label-caps`, tinted `secondary-fixed-dim`.

### 4.10 Filter tabs

A segmented control: `p-1 bg-surface-container rounded-xl` holding
`px-3 py-1.5 rounded-lg` buttons in `label-caps`. The active tab inverts to
`bg-primary-container text-on-primary-container font-semibold`; inactive tabs are
bare `text-on-surface-variant` with a hover to `text-on-surface`. A compact
`rounded-md px-2.5 py-1` variant is used inside cards.

---

## 5. Layout Principles

### 5.1 Global frame

Every screen shares the same chrome:

- **Icon rail:** fixed left, **80px** wide (`w-20`), `bg-surface-container-lowest`,
  `border-r border-outline-variant`. Holds a 40px logo tile, a vertical stack of
  48px `rounded-xl` nav targets (`gap-3`), and a pinned footer group: a quick-add
  button, a 1px divider, and a pulsing mint "system live" dot.
  The active item inverts: `bg-primary-container text-on-primary-container rounded-xl`.
- **Top bar:** fixed, **64px** tall (`h-16`), offset `left-20`,
  `bg-surface-container-lowest/90` with `backdrop-blur-xl` and a bottom hairline.
  Left: a `label-caps` breadcrumb — `BIO-SYSTEM v1.0 / <MODULE> // <CONTEXT>` —
  followed by live integration status pills. Right: a 256–320px command input, a
  settings icon button, a 32px circular avatar.
- **Content:** `pl-20 pt-16`, `max-w-[1720px] mx-auto`, padded by
  `container-padding` (24px), sections separated by `gap-6`.

### 5.2 Grid

- **Desktop:** `grid grid-cols-1 md:grid-cols-12 gap-card-gap` with
  `auto-rows-[minmax(180px,auto)]`. Cards span **4, 6, 8 or 12** columns — an 8/4
  split (primary + sidebar) and a 6/6 split (paired modules) do most of the work.
  Stat-tile rows break the 12-col grid for a simpler `grid-cols-2 md:grid-cols-4`.
- **Mobile:** single-column stack, 16px side margins (`margin-mobile`). Breakpoints
  used are `md`, `lg` and `xl`; `xl` is where three-column workspace layouts appear.
- **Target viewport:** 1440px+ (screens are authored at 2560×2048–3608).

### 5.3 Spacing scale

Built on a **4px unit**, with named steps:

| Token | Value | Role |
| --- | --- | --- |
| `unit` | 4px | The baseline. All vertical rhythm is a multiple. |
| `margin-mobile` | 16px | Mobile side gutter. |
| `gutter` | 16px | Intra-component gap. |
| `card-gap` | **20px** | The gap between bento cards. Distinct from the 24px card padding. |
| `container-padding` | 24px | Page-level padding and default card padding (`p-6`). |
| `margin-desktop` | 40px | Wide-viewport outer margin. |

Common gaps in practice: `gap-1.5` (6px) between an icon and its label, `gap-2`/
`gap-3` inside a card, `gap-4` between stat tiles, `gap-6` between page sections.

### 5.4 Whitespace strategy

Dense at the data layer, generous at the container layer. A table row is 12px of
vertical padding; the card holding it gets 24px on every side. The result reads as
*instrumented* rather than cramped — there is a lot on screen, but each region has
clear air around it.

---

## 6. Motion

Restrained and continuous, never transitional:

- `transition-all` at the default duration on every interactive element; a few use
  `duration-200`/`duration-300`.
- `animate-pulse` on "active" dots, `animate-ping` on live/streaming indicators.
- `scale-95 active:scale-90` on tappable tiles.
- `group-hover:translate-x-0.5 group-hover:-translate-y-0.5` on a launch icon — the
  only directional movement in the system.
- A 4s linear scanline loop over the AI panel; a 2s opacity pulse on "thinking"
  placeholders.

No page transitions, no entrance animations, no parallax.

---

## 7. Mockup vs. shipped app

The app implements this system with three deliberate substitutions. **Follow the
app, not the mockups, on these points.**

| Concern | Stitch mockups | Shipped app (`app/globals.css`, `lib/theme.ts`) |
| --- | --- | --- |
| **Heading font** | Geist | **Bricolage Grotesque** (`--font-display`) |
| **Body font** | Inter | **Instrument Sans** (`--font-body`) |
| **Numeric/tabular font** | Geist (`data-display`) | **IBM Plex Mono** (`--font-mono`) |
| **Icons** | Material Symbols Outlined | **lucide-react** — a second icon system is not worth it |
| **Module accents** | orange + pink only | full set: mint Health, blue Money, orange Education, pink Research, purple Habits/Todos, amber People, crimson Bible, teal Workspaces |
| **Card radius** | `rounded-xl` = 0.75rem | `--radius-card: 0.75rem` — same value |
| **Glass** | hand-rolled `backdrop-filter` CSS | **glinui** tokens (`--glass-*`), so widgets share one implementation |
| **Per-workspace colour** | n/a | `--ws-accent` CSS variable + `ws-accent` Tailwind token, so components never thread colour props |

Everything else — the surface ladder, the type scale, the 4px/20px/24px spacing,
the pill-shaped status vocabulary, the 1px `outline-variant` border, the
`0 0 15px rgba(accent, 0.2)` hover glow — is carried over unchanged. The colour
hexes in §2 are identical to the `@theme` block in `app/globals.css`.

**One inconsistency to be aware of:** the project-level Stitch theme declares a
different radius ramp (`sm` 0.25 / `DEFAULT` 0.5 / `md` 0.75 / `lg` 1 / `xl` 1.5rem)
than the per-screen Tailwind config the screens actually render with
(`DEFAULT` 0.25 / `lg` 0.5 / `xl` 0.75rem). The **per-screen** ramp is what the
mockups look like and what the app matches; §4.1 documents that one.

### Screens not yet reflected in the app

The **Workspaces // Coastal Erosion Essay** and **Instagram Follows // People CRM**
screens were designed after the corresponding modules were built, so the shipped
`/workspaces/[id]` and `/people` pages do not yet use these layouts. Patterns worth
porting: the four-ring stat strip and timeline thinking-log (§4.7, §4.9) for
Workspaces, and the table row / avatar-tint / bulk-bar pattern (§4.8) for Instagram
follows.
