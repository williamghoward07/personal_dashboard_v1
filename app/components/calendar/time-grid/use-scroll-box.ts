'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * A scroll container's visible height and its vertical scrollbar's width.
 * The height drives "Fit day"; the scrollbar width pads the day headers
 * above the grid so their columns line up with the scrolling ones (a
 * classic scrollbar steals width from the grid, not from the headers).
 */
export function useScrollBox(ref: RefObject<HTMLElement | null>): { height: number; scrollbarPx: number } {
  const [box, setBox] = useState({ height: 0, scrollbarPx: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const next = { height: el.clientHeight, scrollbarPx: el.offsetWidth - el.clientWidth - el.clientLeft * 2 }
      setBox((prev) => (prev.height === next.height && prev.scrollbarPx === next.scrollbarPx ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return box
}
