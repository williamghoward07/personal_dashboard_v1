import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('keeps a BIO-SYSTEM type size alongside a text colour', () => {
    // Regression: tailwind-merge used to classify `text-headline-lg` as a
    // colour and drop it, leaving only `text-on-surface`.
    expect(cn('text-headline-lg', 'text-on-surface')).toBe(
      'text-headline-lg text-on-surface',
    )
    expect(cn('text-label-caps', 'text-outline')).toBe(
      'text-label-caps text-outline',
    )
  })

  it('still lets one type size override another', () => {
    expect(cn('text-body-sm', 'text-headline-xl')).toBe('text-headline-xl')
    expect(cn('text-label-caps', 'text-data-display')).toBe('text-data-display')
  })

  it('still lets a stock Tailwind size override a custom one and vice versa', () => {
    expect(cn('text-headline-lg', 'text-xs')).toBe('text-xs')
    expect(cn('text-xs', 'text-headline-lg')).toBe('text-headline-lg')
  })

  it('still lets one text colour override another', () => {
    expect(cn('text-on-surface', 'text-outline')).toBe('text-outline')
  })

  it('leaves the @utility type classes untouched', () => {
    expect(cn('label-caps', 'text-outline')).toBe('label-caps text-outline')
  })
})
