'use client'

import type { Accent } from '@/lib/theme'
import { ACCENT_TEXT } from '@/lib/theme'

export default function LiquidSwitch<T extends string>({
  options,
  value,
  onChange,
  accent = 'mint',
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  accent?: Accent
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  const count = options.length

  return (
    <div className="relative flex w-fit shrink-0 rounded-full border border-outline-variant/60 bg-surface-container-highest/50 p-0.5 backdrop-blur-sm">
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-gradient-to-b from-white/20 to-white/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          left: `calc(${(activeIndex / count) * 100}% + 2px)`,
          width: `calc(${100 / count}% - 4px)`,
        }}
        aria-hidden
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`relative z-10 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300 active:scale-95 ${
            o.value === value ? ACCENT_TEXT[accent] : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
