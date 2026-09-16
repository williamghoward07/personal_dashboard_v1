'use client'

import { Ban, Check } from 'lucide-react'
import type { Accent } from '@/lib/theme'
import { ACCENT_BAR } from '@/lib/theme'

// A row of accent swatches (lib/theme.ts Accent keys). Callers pass the
// options their DB column allows — e.g. link_folders rejects teal. With
// `noneLabel`, a leading "no colour" swatch sets the value to null
// (for things that inherit a colour from their parent).
export default function AccentPicker({
  value,
  options,
  onChange,
  noneLabel,
}: {
  value: Accent | null
  options: Accent[]
  onChange: (value: Accent | null) => void
  noneLabel?: string
}) {
  const swatchClass = 'flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110'
  const selectedStyle = (selected: boolean) => ({
    outline: selected ? '2px solid var(--color-on-surface)' : 'none',
    outlineOffset: 2,
  })

  return (
    <div role="radiogroup" className="flex flex-wrap items-center gap-2 pt-1">
      {noneLabel && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label={noneLabel}
          title={noneLabel}
          onClick={() => onChange(null)}
          className={`${swatchClass} border border-dashed border-outline text-on-surface-variant`}
          style={selectedStyle(value === null)}
        >
          <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
      {options.map((accent) => (
        <button
          key={accent}
          type="button"
          role="radio"
          aria-checked={value === accent}
          aria-label={`Colour ${accent}`}
          title={accent}
          onClick={() => onChange(accent)}
          className={`${swatchClass} ${ACCENT_BAR[accent]}`}
          style={selectedStyle(value === accent)}
        >
          {value === accent && <Check className="h-3.5 w-3.5 text-surface-container-lowest" strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}
