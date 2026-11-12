'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * The height that makes `ref`'s element end exactly at the bottom of the
 * viewport, less `bottomGapPx` (the padding and borders of whatever wraps
 * it). Re-measured on resize and whenever the element moves (a toolbar
 * above it wrapping onto a second line), so a full-page view like the
 * calendar always fits the window without the page scrolling. `null`
 * until the first measurement, so SSR markup stays deterministic.
 */
export function useFillViewportHeight(
  ref: RefObject<HTMLElement | null>,
  bottomGapPx: number,
  minPx: number
): number | null {
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      setHeight(Math.max(minPx, Math.floor(window.innerHeight - top - bottomGapPx)))
    }
    measure()
    window.addEventListener('resize', measure)
    // Anything above the element changing height moves it down or up.
    const observer = new ResizeObserver(measure)
    if (el.parentElement) observer.observe(el.parentElement)
    if (el.previousElementSibling) observer.observe(el.previousElementSibling)
    return () => {
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [ref, bottomGapPx, minPx])

  return height
}
