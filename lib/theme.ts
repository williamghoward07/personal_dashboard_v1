export type Accent = 'mint' | 'blue' | 'orange' | 'pink' | 'purple' | 'neutral'

export const ACCENT_TEXT: Record<Accent, string> = {
  mint: 'text-primary-container',
  blue: 'text-secondary-container',
  orange: 'text-academic-orange',
  pink: 'text-research-pink',
  purple: 'text-habit-purple',
  neutral: 'text-on-surface-variant',
}

export const ACCENT_GLOW: Record<Accent, string> = {
  mint: 'hover:border-primary-container/50 hover:shadow-[0_0_15px_rgba(0,255,157,0.2)]',
  blue: 'hover:border-secondary-container/50 hover:shadow-[0_0_15px_rgba(20,209,255,0.2)]',
  orange: 'hover:border-academic-orange/50 hover:shadow-[0_0_15px_rgba(255,107,0,0.2)]',
  pink: 'hover:border-research-pink/50 hover:shadow-[0_0_15px_rgba(255,0,127,0.2)]',
  purple: 'hover:border-habit-purple/50 hover:shadow-[0_0_15px_rgba(192,132,252,0.2)]',
  neutral: 'hover:border-outline/50',
}

export const ACCENT_CHIP: Record<Accent, string> = {
  mint: 'bg-primary-container/10 text-primary-container border-primary-container/30',
  blue: 'bg-secondary-container/10 text-secondary-container border-secondary-container/30',
  orange: 'bg-academic-orange/10 text-academic-orange border-academic-orange/30',
  pink: 'bg-research-pink/10 text-research-pink border-research-pink/30',
  purple: 'bg-habit-purple/10 text-habit-purple border-habit-purple/30',
  neutral: 'bg-surface-container-highest text-on-surface-variant border-outline-variant',
}

export const ACCENT_BAR: Record<Accent, string> = {
  mint: 'bg-primary-container',
  blue: 'bg-secondary-container',
  orange: 'bg-academic-orange',
  pink: 'bg-research-pink',
  purple: 'bg-habit-purple',
  neutral: 'bg-outline',
}

export const ACCENT_VAR: Record<Accent, string> = {
  mint: 'var(--color-primary-container)',
  blue: 'var(--color-secondary-container)',
  orange: 'var(--color-academic-orange)',
  pink: 'var(--color-research-pink)',
  purple: 'var(--color-habit-purple)',
  neutral: 'var(--color-outline)',
}

export const MODULE_ACCENT: Record<
  'home' | 'health' | 'education' | 'money' | 'research' | 'habits' | 'calendar',
  Accent
> = {
  home: 'neutral',
  health: 'mint',
  education: 'orange',
  money: 'blue',
  research: 'pink',
  habits: 'purple',
  calendar: 'neutral',
}
