export type Accent = 'mint' | 'blue' | 'orange' | 'pink' | 'purple' | 'amber' | 'crimson' | 'teal' | 'neutral'

/**
 * Accent selector accepted by the shared components in `components/ui`.
 *
 * `'ws'` is not a colour a user can pick — it means "follow the current
 * workspace's `--ws-accent` variable" (see `--color-ws-accent` in
 * `app/globals.css`), so a badge or chip rendered inside a workspace page
 * takes that workspace's colour without anyone threading a prop down.
 * Everything else is a fixed module accent.
 *
 * Every class string below is written out in full on purpose: Tailwind v4's
 * JIT scanner cannot see a class assembled from a template literal, so these
 * static lookup tables are the only safe way to vary colour at runtime.
 */
export type UiAccent = Accent | 'ws'

export const ACCENT_TEXT: Record<UiAccent, string> = {
  mint: 'text-primary-container',
  blue: 'text-secondary-container',
  orange: 'text-academic-orange',
  pink: 'text-research-pink',
  purple: 'text-habit-purple',
  amber: 'text-people-amber',
  crimson: 'text-bible-crimson',
  teal: 'text-workspace-teal',
  neutral: 'text-on-surface-variant',
  ws: 'text-ws-accent',
}

export const ACCENT_GLOW: Record<UiAccent, string> = {
  mint: 'hover:border-primary-container/50 hover:shadow-[0_0_15px_rgba(0,255,157,0.2)]',
  blue: 'hover:border-secondary-container/50 hover:shadow-[0_0_15px_rgba(20,209,255,0.2)]',
  orange: 'hover:border-academic-orange/50 hover:shadow-[0_0_15px_rgba(255,107,0,0.2)]',
  pink: 'hover:border-research-pink/50 hover:shadow-[0_0_15px_rgba(255,0,127,0.2)]',
  purple: 'hover:border-habit-purple/50 hover:shadow-[0_0_15px_rgba(192,132,252,0.2)]',
  amber: 'hover:border-people-amber/50 hover:shadow-[0_0_15px_rgba(255,194,51,0.2)]',
  crimson: 'hover:border-bible-crimson/50 hover:shadow-[0_0_15px_rgba(255,59,59,0.2)]',
  teal: 'hover:border-workspace-teal/50 hover:shadow-[0_0_15px_rgba(45,212,191,0.2)]',
  neutral: 'hover:border-outline/50',
  ws: 'hover:border-ws-accent/50 hover:shadow-[0_0_15px_color-mix(in_srgb,var(--color-ws-accent)_20%,transparent)]',
}

export const ACCENT_CHIP: Record<UiAccent, string> = {
  mint: 'bg-primary-container/10 text-primary-container border-primary-container/30',
  blue: 'bg-secondary-container/10 text-secondary-container border-secondary-container/30',
  orange: 'bg-academic-orange/10 text-academic-orange border-academic-orange/30',
  pink: 'bg-research-pink/10 text-research-pink border-research-pink/30',
  purple: 'bg-habit-purple/10 text-habit-purple border-habit-purple/30',
  amber: 'bg-people-amber/10 text-people-amber border-people-amber/30',
  crimson: 'bg-bible-crimson/10 text-bible-crimson border-bible-crimson/30',
  teal: 'bg-workspace-teal/10 text-workspace-teal border-workspace-teal/30',
  neutral: 'bg-surface-container-highest text-on-surface-variant border-outline-variant',
  ws: 'bg-ws-accent/10 text-ws-accent border-ws-accent/30',
}

export const ACCENT_BAR: Record<UiAccent, string> = {
  mint: 'bg-primary-container',
  blue: 'bg-secondary-container',
  orange: 'bg-academic-orange',
  pink: 'bg-research-pink',
  purple: 'bg-habit-purple',
  amber: 'bg-people-amber',
  crimson: 'bg-bible-crimson',
  teal: 'bg-workspace-teal',
  neutral: 'bg-outline',
  ws: 'bg-ws-accent',
}

export const ACCENT_VAR: Record<UiAccent, string> = {
  mint: 'var(--color-primary-container)',
  blue: 'var(--color-secondary-container)',
  orange: 'var(--color-academic-orange)',
  pink: 'var(--color-research-pink)',
  purple: 'var(--color-habit-purple)',
  amber: 'var(--color-people-amber)',
  crimson: 'var(--color-bible-crimson)',
  teal: 'var(--color-workspace-teal)',
  neutral: 'var(--color-outline)',
  ws: 'var(--color-ws-accent)',
}

/**
 * Strong status badge — DESIGN.md §4.5: accent at 15% background, a 1px
 * solid accent border, accent text. Pair with `rounded-full px-3 py-1
 * text-label-caps`.
 */
export const ACCENT_BADGE: Record<UiAccent, string> = {
  mint: 'bg-primary-container/15 border-primary-container text-primary-container',
  blue: 'bg-secondary-container/15 border-secondary-container text-secondary-container',
  orange: 'bg-academic-orange/15 border-academic-orange text-academic-orange',
  pink: 'bg-research-pink/15 border-research-pink text-research-pink',
  purple: 'bg-habit-purple/15 border-habit-purple text-habit-purple',
  amber: 'bg-people-amber/15 border-people-amber text-people-amber',
  crimson: 'bg-bible-crimson/15 border-bible-crimson text-bible-crimson',
  teal: 'bg-workspace-teal/15 border-workspace-teal text-workspace-teal',
  neutral: 'bg-surface-container-highest border-outline-variant text-on-surface-variant',
  ws: 'bg-ws-accent/15 border-ws-accent text-ws-accent',
}

/**
 * Accent at 20% with accent text — DESIGN.md §4.8 avatar tints and §4.9
 * timeline kind pills. Softer than ACCENT_BADGE and borderless.
 */
export const ACCENT_SOFT: Record<UiAccent, string> = {
  mint: 'bg-primary-container/20 text-primary-container',
  blue: 'bg-secondary-container/20 text-secondary-container',
  orange: 'bg-academic-orange/20 text-academic-orange',
  pink: 'bg-research-pink/20 text-research-pink',
  purple: 'bg-habit-purple/20 text-habit-purple',
  amber: 'bg-people-amber/20 text-people-amber',
  crimson: 'bg-bible-crimson/20 text-bible-crimson',
  teal: 'bg-workspace-teal/20 text-workspace-teal',
  neutral: 'bg-surface-container-highest text-on-surface-variant',
  ws: 'bg-ws-accent/20 text-ws-accent',
}

/**
 * Inverted / solid fill with a readable foreground — the active filter tab
 * (DESIGN.md §4.10), the current pagination page (§4.8) and the primary
 * button (§4.4). Mint and blue use their own `on-*-container` tokens as the
 * spec names; the module accents have no such token, so they fall back to
 * the near-black ground, which clears 4.5:1 against every one of them.
 */
export const ACCENT_SOLID: Record<UiAccent, string> = {
  mint: 'bg-primary-container text-on-primary-container',
  blue: 'bg-secondary-container text-on-secondary-container',
  orange: 'bg-academic-orange text-surface-container-lowest',
  pink: 'bg-research-pink text-surface-container-lowest',
  purple: 'bg-habit-purple text-surface-container-lowest',
  amber: 'bg-people-amber text-surface-container-lowest',
  crimson: 'bg-bible-crimson text-surface-container-lowest',
  teal: 'bg-workspace-teal text-surface-container-lowest',
  neutral: 'bg-on-surface-variant text-surface-container-lowest',
  ws: 'bg-ws-accent text-surface-container-lowest',
}

/** A 30%-opacity accent border — DESIGN.md §4.5 entity chips. */
export const ACCENT_BORDER: Record<UiAccent, string> = {
  mint: 'border-primary-container/30',
  blue: 'border-secondary-container/30',
  orange: 'border-academic-orange/30',
  pink: 'border-research-pink/30',
  purple: 'border-habit-purple/30',
  amber: 'border-people-amber/30',
  crimson: 'border-bible-crimson/30',
  teal: 'border-workspace-teal/30',
  neutral: 'border-outline-variant',
  ws: 'border-ws-accent/30',
}

/**
 * Ghost-accent button — DESIGN.md §4.4: `bg-<accent>/10`, a 30% accent
 * border, accent text, hover to `bg-<accent>/20`.
 */
export const ACCENT_GHOST: Record<UiAccent, string> = {
  mint: 'bg-primary-container/10 border-primary-container/30 text-primary-container hover:bg-primary-container/20',
  blue: 'bg-secondary-container/10 border-secondary-container/30 text-secondary-container hover:bg-secondary-container/20',
  orange: 'bg-academic-orange/10 border-academic-orange/30 text-academic-orange hover:bg-academic-orange/20',
  pink: 'bg-research-pink/10 border-research-pink/30 text-research-pink hover:bg-research-pink/20',
  purple: 'bg-habit-purple/10 border-habit-purple/30 text-habit-purple hover:bg-habit-purple/20',
  amber: 'bg-people-amber/10 border-people-amber/30 text-people-amber hover:bg-people-amber/20',
  crimson: 'bg-bible-crimson/10 border-bible-crimson/30 text-bible-crimson hover:bg-bible-crimson/20',
  teal: 'bg-workspace-teal/10 border-workspace-teal/30 text-workspace-teal hover:bg-workspace-teal/20',
  neutral: 'bg-surface-container-high/60 border-outline-variant text-on-surface-variant hover:bg-surface-container-highest',
  ws: 'bg-ws-accent/10 border-ws-accent/30 text-ws-accent hover:bg-ws-accent/20',
}

/**
 * Input focus — DESIGN.md §4.6: a border-colour change to the accent plus
 * the §4.3 Cyber Glow. The focus ring itself is always suppressed by the
 * component (`focus:outline-none`); this is the whole focus affordance.
 */
export const ACCENT_FOCUS: Record<UiAccent, string> = {
  mint: 'focus:border-primary-container focus:shadow-[0_0_15px_rgba(0,255,157,0.2)]',
  blue: 'focus:border-secondary-container focus:shadow-[0_0_15px_rgba(20,209,255,0.2)]',
  orange: 'focus:border-academic-orange focus:shadow-[0_0_15px_rgba(255,107,0,0.2)]',
  pink: 'focus:border-research-pink focus:shadow-[0_0_15px_rgba(255,0,127,0.2)]',
  purple: 'focus:border-habit-purple focus:shadow-[0_0_15px_rgba(192,132,252,0.2)]',
  amber: 'focus:border-people-amber focus:shadow-[0_0_15px_rgba(255,194,51,0.2)]',
  crimson: 'focus:border-bible-crimson focus:shadow-[0_0_15px_rgba(255,59,59,0.2)]',
  teal: 'focus:border-workspace-teal focus:shadow-[0_0_15px_rgba(45,212,191,0.2)]',
  neutral: 'focus:border-outline',
  ws: 'focus:border-ws-accent focus:shadow-[0_0_15px_color-mix(in_srgb,var(--color-ws-accent)_20%,transparent)]',
}

export const MODULE_ACCENT: Record<
  | 'home'
  | 'health'
  | 'education'
  | 'money'
  | 'research'
  | 'habits'
  | 'calendar'
  | 'people'
  | 'todos'
  | 'bible'
  | 'apps'
  | 'workspaces',
  Accent
> = {
  home: 'neutral',
  health: 'mint',
  education: 'orange',
  money: 'blue',
  research: 'pink',
  habits: 'purple',
  calendar: 'neutral',
  people: 'amber',
  todos: 'purple',
  bible: 'crimson',
  apps: 'neutral',
  workspaces: 'teal',
}

/** Every user-pickable accent, in palette order. Excludes `'ws'`. */
export const ACCENTS: readonly Accent[] = [
  'mint',
  'blue',
  'orange',
  'pink',
  'purple',
  'amber',
  'crimson',
  'teal',
  'neutral',
]
