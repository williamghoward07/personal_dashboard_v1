'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { EyeOff, GripVertical, MoveHorizontal } from 'lucide-react'
import { spanClass, spanFromPointer, type HomeWidgetSpan } from '@/lib/home/layout'

export interface HomeWidgetFrameProps {
  id: string
  label: string
  span: HomeWidgetSpan
  editing: boolean
  /** The grid element, measured to turn a pointer position into a span. */
  gridRef: RefObject<HTMLDivElement | null>
  onHide: (id: string) => void
  /** Local-only span change while the corner handle is being dragged. */
  onSpanPreview: (id: string, span: HomeWidgetSpan) => void
  /** Final span for the gesture — this is the one that persists. */
  onSpanCommit: (id: string, span: HomeWidgetSpan) => void
  children: ReactNode
}

interface ResizeOrigin {
  left: number
  track: number
  gap: number
}

/**
 * One cell of the home bento grid: the column span, the drag-to-reorder
 * handle, the hide button and the corner resize handle.
 *
 * Two structural rules this component exists to keep:
 *
 * 1. **The tree shape never changes between modes.** `children` always sits
 *    in the same position, so toggling edit mode does not remount a widget
 *    (every home widget fetches its own data on mount — remounting them all
 *    on every toggle would refetch the whole page).
 * 2. **Drag listeners live on the grip handle only**, never the card, or the
 *    widgets' own links and buttons lose their pointer events to the sensor
 *    (the pattern from widgets/habits/HabitCard.tsx).
 */
export default function HomeWidgetFrame({
  id,
  label,
  span,
  editing,
  gridRef,
  onHide,
  onSpanPreview,
  onSpanCommit,
  children,
}: HomeWidgetFrameProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  })

  const nodeRef = useRef<HTMLDivElement | null>(null)
  const resizeRef = useRef<ResizeOrigin | null>(null)
  // Masonry: the grid has 1px implicit rows and no row gap, so each card
  // spans as many rows as it is tall (plus the gap) and the next card in
  // its column packs straight up under it.
  const [rowSpan, setRowSpan] = useState<number | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    const grid = gridRef.current
    if (!node || !grid) return
    const update = () => {
      const gap = Number.parseFloat(window.getComputedStyle(grid).columnGap) || 0
      const height = node.getBoundingClientRect().height
      // A collapsed (empty) widget is display:none; give it no rows at all.
      setRowSpan(height > 0 ? Math.ceil(height + gap) : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [gridRef])

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node
      setNodeRef(node)
    },
    [setNodeRef]
  )

  // The grid's *used* track sizes, straight from the computed style, so the
  // snap points are the real column edges rather than an assumed width.
  const measure = useCallback((): ResizeOrigin | null => {
    const grid = gridRef.current
    const node = nodeRef.current
    if (!grid || !node) return null

    const style = window.getComputedStyle(grid)
    const tracks = style.gridTemplateColumns
      .split(' ')
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value) && value > 0)
    if (tracks.length === 0) return null

    return {
      left: node.getBoundingClientRect().left,
      track: tracks[0],
      gap: Number.parseFloat(style.columnGap) || 0,
    }
  }, [gridRef])

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const origin = measure()
      if (!origin) return
      // The origin is captured once and kept for the whole gesture: if a
      // widen pushes the card onto the next row its left edge moves, and
      // re-measuring mid-drag would make the span oscillate.
      resizeRef.current = origin
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [measure]
  )

  const handleResizeMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const origin = resizeRef.current
      if (!origin) return
      const next = spanFromPointer(event.clientX, origin.left, origin.track, origin.gap, span)
      if (next !== span) onSpanPreview(id, next)
    },
    [id, onSpanPreview, span]
  )

  const handleResizeEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!resizeRef.current) return
      resizeRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      onSpanCommit(id, span)
    },
    [id, onSpanCommit, span]
  )

  const handleResizeKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step === 0) return
      event.preventDefault()
      const next = Math.min(4, Math.max(1, span + step)) as HomeWidgetSpan
      if (next !== span) onSpanCommit(id, next)
    },
    [id, onSpanCommit, span]
  )

  return (
    <div
      ref={setRefs}
      style={{
        transform: transform
          ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
          : undefined,
        transition: transition ?? undefined,
        gridRowEnd: rowSpan ? `span ${rowSpan}` : undefined,
      }}
      className={[
        spanClass(span),
        editing ? 'relative flex flex-col gap-2' : '',
        // A widget is allowed to render nothing (MorningRoutineCard does
        // once its setup offer is dismissed). Outside edit mode the empty
        // cell collapses instead of leaving a hole in the row; in edit mode
        // it stays, so it can still be moved or hidden.
        editing ? '' : 'has-[>div:empty]:hidden',
        isDragging ? 'z-10 opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {editing ? (
        <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-high px-1.5 py-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${label}`}
            className="shrink-0 touch-none cursor-grab rounded-sm p-1 text-on-surface-variant/60 transition-colors hover:bg-surface-container-highest hover:text-on-surface active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="label-caps truncate text-on-surface-variant">{label}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-on-surface-variant/70" aria-hidden="true">
            {span}/4
          </span>
          <button
            type="button"
            onClick={() => onHide(id)}
            aria-label={`Hide ${label}`}
            title={`Hide ${label}`}
            className="shrink-0 rounded-sm p-1 text-on-surface-variant/60 transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* `contents` outside edit mode so this wrapper adds no layout of its
          own; in edit mode it swallows clicks so arranging the grid can't
          navigate away through a card's link. */}
      <div className={editing ? 'pointer-events-none select-none' : 'contents'}>{children}</div>

      {editing ? (
        <button
          type="button"
          role="slider"
          tabIndex={0}
          aria-label={`${label} width`}
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={span}
          aria-valuetext={`${span} of 4 columns`}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          onKeyDown={handleResizeKey}
          // Resizing only means something where the grid really has four
          // columns; below xl it is two, and the span classes collapse.
          className="absolute -right-2 -bottom-2 hidden h-6 w-6 cursor-ew-resize touch-none items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary-container xl:flex"
        >
          <MoveHorizontal className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}
