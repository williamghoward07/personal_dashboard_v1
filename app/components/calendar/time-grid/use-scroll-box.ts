'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

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
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return box
}

/**
 * Scrolls a freshly-shown grid to `targetPx` once per `resetKey` (visible
 * day/week or zoom level), as soon as it can actually scroll. Before the
 * calendar body has been sized to the window the grid is as tall as its
 * content and can't scroll, so a scroll on mount would be lost; waiting
 * for `viewportPx` to change retries it. The current-time tick must not
 * yank the user's scroll position, so `targetPx` isn't a dependency.
 */
export function useInitialScroll(
  ref: RefObject<HTMLElement | null>,
  resetKey: string,
  targetPx: number,
  viewportPx: number
): void {
  const doneKey = useRef<string | null>(null)
  const target = useRef(targetPx)

  useEffect(() => {
    target.current = targetPx
  }, [targetPx])

  useEffect(() => {
    const el = ref.current
    if (!el || doneKey.current === resetKey) return
    // Not scrollable yet: try again when the viewport height is known.
    if (el.scrollHeight <= el.clientHeight) return
    el.scrollTo({ top: target.current })
    doneKey.current = resetKey
  }, [ref, resetKey, viewportPx])
}
