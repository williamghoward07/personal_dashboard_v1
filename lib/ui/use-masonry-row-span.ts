import { useEffect, useState, type RefObject } from 'react'

/**
 * Masonry packing for a CSS grid with `auto-rows-[1px]` and no row gap: the
 * returned value is the `grid-row-end` span that makes `ref`'s element as
 * tall as its content (plus the grid's column gap, reused as the row gap),
 * so the next item in its column packs straight up under it.
 */
export function useMasonryRowSpan(ref: RefObject<HTMLElement | null>): number | null {
  const [rowSpan, setRowSpan] = useState<number | null>(null)

  useEffect(() => {
    const node = ref.current
    const grid = node?.parentElement
    if (!node || !grid) return
    const update = () => {
      const gap = Number.parseFloat(window.getComputedStyle(grid).columnGap) || 0
      const height = node.getBoundingClientRect().height
      setRowSpan(height > 0 ? Math.ceil(height + gap) : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return rowSpan
}
