'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EyeOff, GripVertical, MoveDiagonal2 } from 'lucide-react'
import {
  LAUNCHER_ROW_STEP,
  MAX_LAUNCHER_ROWS,
  MIN_LAUNCHER_ROWS,
  clampLauncherRows,
  launcherHeightForRows,
  launcherRowsForHeight,
  stepLauncherSpan,
} from '@/lib/app-launcher/launcher-layout'
import { MIN_WIDGET_HEIGHT, MAX_WIDGET_HEIGHT } from '@/lib/settings/schema'
import { HOME_GRID_COLUMNS, heightFromPointer, spanClass, type HomeWidgetSpan } from '@/lib/home/layout'

export interface HomeWidgetFrameProps {
  id: string
  label: string
  span: HomeWidgetSpan
  /** Minimum card height in px; undefined sizes to content. */
  height?: number
  editing: boolean
  /** The grid element, measured to turn a pointer position into a span. */
  gridRef: RefObject<HTMLDivElement | null>
  gridColumns?: number
  onHide: (id: string) => void
  /** Local-only size change while the corner handle is being dragged. */
  onSizePreview: (id: string, span: HomeWidgetSpan, height: number | undefined) => void
  /** Final size for the gesture — this is the one that persists. */
  onSizeCommit: (id: string, span: HomeWidgetSpan, height: number | undefined) => void
  children: ReactNode | ((width: number | undefined) => ReactNode)
}

interface GridMeasurement {
  left: number
  top: number
  columns: number
  track: number
  gap: number
}

interface ResizeOrigin extends GridMeasurement {
  startX: number
  startY: number
  startSpan: HomeWidgetSpan
  startRows: number
  startHeight: number
  originalHeight: number | undefined
  touchedHeight: boolean
  nextSpan: HomeWidgetSpan
  nextHeight: number | undefined
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
  height,
  editing,
  gridRef,
  gridColumns = HOME_GRID_COLUMNS,
  onHide,
  onSizePreview,
  onSizeCommit,
  children,
}: HomeWidgetFrameProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  })

  const nodeRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const resizeRef = useRef<ResizeOrigin | null>(null)
  const isLauncher = id === 'app-launcher'
  const rows = launcherRowsForHeight(height)
  const minHeight = isLauncher ? undefined : height
  // Masonry: the grid has 1px implicit rows and no row gap, so each card
  // spans as many rows as it is tall (plus the gap) and the next card in
  // its column packs straight up under it.
  const [measuredWidth, setMeasuredWidth] = useState<number | undefined>(undefined)
  const [rowSpan, setRowSpan] = useState<number | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    const grid = gridRef.current
    if (!node || !grid) return
    const update = () => {
      const gap = Number.parseFloat(window.getComputedStyle(grid).columnGap) || 0
      const { height, width } = node.getBoundingClientRect()
      if (width > 0) setMeasuredWidth(Math.round(width))
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
  const measure = useCallback((): GridMeasurement | null => {
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
      top: node.getBoundingClientRect().top,
      columns: tracks.length,
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
      resizeRef.current = {
        ...origin,
        startX: event.clientX,
        startY: event.clientY,
        startSpan: span,
        startRows: rows,
        originalHeight: height,
        startHeight: height ?? Math.max(MIN_WIDGET_HEIGHT, (contentRef.current?.firstElementChild?.getBoundingClientRect().height || 240)),
        touchedHeight: height !== undefined,
        nextSpan: span,
        nextHeight: height,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    },
    [measure, span, rows, height]
  )

  const handleResizeMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const origin = resizeRef.current
      if (!origin) return
      if (isLauncher) {
        // Use movement from the grab point so the card can be widened
        // even if the grid has to move it to another column during the drag.
        const columnStep = Math.round((event.clientX - origin.startX) / (origin.track + origin.gap))
        const rowStep = Math.round((event.clientY - origin.startY) / LAUNCHER_ROW_STEP)
        const nextSpan = stepLauncherSpan(origin.startSpan, columnStep, origin.columns)
        const nextHeight = launcherHeightForRows(clampLauncherRows(origin.startRows + rowStep))
        if (nextSpan === origin.nextSpan && nextHeight === origin.nextHeight) return
        origin.nextSpan = nextSpan
        origin.nextHeight = nextHeight
        onSizePreview(id, nextSpan, nextHeight)
        return
      }
      // Height only becomes explicit once the pointer actually moves
      // vertically, so a purely horizontal drag keeps the card on auto.
      if (Math.abs(event.clientY - origin.startY) > 6) origin.touchedHeight = true
      const columnStep = Math.round((event.clientX - origin.startX) / (origin.track + origin.gap))
      const nextSpan = stepLauncherSpan(origin.startSpan, columnStep, origin.columns)
      const nextHeight = origin.touchedHeight
        ? heightFromPointer(origin.startHeight + event.clientY - origin.startY, 0, 0)
        : origin.nextHeight
      if (nextSpan === origin.nextSpan && nextHeight === origin.nextHeight) return
      origin.nextSpan = nextSpan
      origin.nextHeight = nextHeight
      onSizePreview(id, nextSpan, nextHeight)
    },
    [id, isLauncher, onSizePreview]
  )

  const handleResizeEnd = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const origin = resizeRef.current
      if (!origin) return
      resizeRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      if (origin.nextSpan !== origin.startSpan || origin.nextHeight !== origin.originalHeight) {
        onSizeCommit(id, origin.nextSpan, origin.nextHeight)
      }
    },
    [id, onSizeCommit]
  )

  const handleResizeCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = resizeRef.current
    if (!origin) return
    resizeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    onSizePreview(id, origin.startSpan, origin.originalHeight)
  }, [id, onSizePreview])

  const resizeLauncherBy = useCallback(
    (columnStep: number, rowStep: number) => {
      const nextSpan = stepLauncherSpan(span, columnStep, gridColumns)
      const nextRows = clampLauncherRows(rows + rowStep)
      if (nextSpan !== span || nextRows !== rows) onSizeCommit(id, nextSpan, launcherHeightForRows(nextRows))
    },
    [id, onSizeCommit, span, gridColumns, rows]
  )

  const handleResizeKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (height === undefined) return
        event.preventDefault()
        onSizeCommit(id, span, undefined)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (isLauncher) {
          resizeLauncherBy(0, event.key === 'ArrowDown' ? 1 : -1)
          return
        }
        const base = height ?? (contentRef.current?.firstElementChild?.getBoundingClientRect().height || 240)
        const next = heightFromPointer(base + (event.key === 'ArrowDown' ? 80 : -80), 0, 0)
        onSizeCommit(id, span, next)
        return
      }
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step === 0) return
      event.preventDefault()
      if (isLauncher) {
        resizeLauncherBy(step, 0)
        return
      }
      const next = stepLauncherSpan(span, step, gridColumns)
      if (next !== span) onSizeCommit(id, next, height)
    },
    [id, isLauncher, onSizeCommit, span, height, resizeLauncherBy, gridColumns]
  )

  const changeHeight = (step: number) => {
    const base = height ?? (contentRef.current?.firstElementChild?.getBoundingClientRect().height || 240)
    onSizeCommit(id, span, heightFromPointer(base + step, 0, 0))
  }

  const width = Math.min(span, gridColumns)
  const sizeText = isLauncher ? `${width}/${gridColumns} wide · ${rows} rows` : `${width}/${gridColumns} wide · ${height ? `${height}px` : 'Auto'}`

  return (
    <div
      ref={setRefs}
      data-home-widget={id}
      style={{
        containerType: 'inline-size',
        containerName: 'home-widget',
        transform: transform
          ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
          : undefined,
        transition: transition ?? undefined,
        gridRowEnd: rowSpan ? `span ${rowSpan}` : undefined,
      }}
      className={[
        spanClass(span),
        'min-w-0',
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
        <div ref={headerRef} className="flex flex-wrap items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-high px-1.5 py-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${label}`}
            className="grid size-11 shrink-0 touch-none cursor-grab place-items-center rounded-sm p-1 text-on-surface-variant/60 transition-colors hover:bg-surface-container-highest hover:text-on-surface active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="label-caps truncate text-on-surface-variant">{label}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-on-surface-variant/70" aria-hidden="true">
            {sizeText}
          </span>
          <button
            type="button"
            onClick={() => onHide(id)}
            aria-label={`Hide ${label}`}
            title={`Hide ${label}`}
            className="grid size-11 shrink-0 place-items-center rounded-sm p-1 text-on-surface-variant/60 transition-colors hover:bg-surface-container-highest hover:text-on-surface"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
          {isLauncher && (
            <div role="group" aria-label="App Launcher size controls" className="flex w-full justify-end gap-1">
              {[
                { label: 'Narrower', Icon: ChevronLeft, dx: -1, dy: 0, disabled: width === 1 },
                { label: 'Wider', Icon: ChevronRight, dx: 1, dy: 0, disabled: width === gridColumns },
                { label: 'Fewer rows', Icon: ChevronUp, dx: 0, dy: -1, disabled: rows === MIN_LAUNCHER_ROWS },
                { label: 'More rows', Icon: ChevronDown, dx: 0, dy: 1, disabled: rows === MAX_LAUNCHER_ROWS },
              ].map(({ label, Icon, dx, dy, disabled }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  title={label}
                  disabled={disabled}
                  onClick={() => resizeLauncherBy(dx, dy)}
                  className="grid size-11 place-items-center rounded-sm text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {editing && !isLauncher && (
        <div role="group" aria-label={`${label} size controls`} className="flex flex-wrap items-center justify-end gap-1 rounded-lg bg-surface-container-high px-1.5">
          {[
            { name: 'Narrower', Icon: ChevronLeft, disabled: width <= 1, run: () => onSizeCommit(id, stepLauncherSpan(span, -1, gridColumns), height) },
            { name: 'Wider', Icon: ChevronRight, disabled: width >= gridColumns, run: () => onSizeCommit(id, stepLauncherSpan(span, 1, gridColumns), height) },
            { name: 'Shorter', Icon: ChevronUp, disabled: height === MIN_WIDGET_HEIGHT, run: () => changeHeight(-80) },
            { name: 'Taller', Icon: ChevronDown, disabled: height === MAX_WIDGET_HEIGHT, run: () => changeHeight(80) },
          ].map(({ name, Icon, disabled, run }) => (
            <button key={name} type="button" aria-label={`${label}: ${name}`} title={name} disabled={disabled} onClick={run} className="grid size-11 place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30"><Icon className="size-4" /></button>
          ))}
          <button type="button" disabled={height === undefined} onClick={() => onSizeCommit(id, span, undefined)} className="min-h-11 rounded-md px-2 text-xs text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-30">Auto height</button>
        </div>
      )}

      {/* `contents` outside edit mode so this wrapper adds no layout of its
          own; in edit mode it swallows clicks so arranging the grid can't
          navigate away through a card's link. */}
      <div
        ref={contentRef}
        className={editing
          ? 'pointer-events-none flex flex-1 select-none flex-col [&>*]:flex-1'
          : minHeight === undefined ? 'contents' : 'flex flex-col [&>*]:flex-1'}
        style={{ minHeight }}
      >
        {typeof children === 'function' ? children(measuredWidth) : children}
      </div>

      {editing ? (
        <button
          type="button"
          role="slider"
          tabIndex={0}
          aria-label={`${label} size`}
          aria-valuemin={1}
          aria-valuemax={gridColumns}
          aria-valuenow={width}
          aria-valuetext={isLauncher ? `${width} of ${gridColumns} columns wide, up to ${rows} app rows` : `${width} of ${gridColumns} columns, ${height ? `${height} pixels tall` : 'automatic height'}`}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeCancel}
          onKeyDown={handleResizeKey}
          onDoubleClick={() => onSizeCommit(id, span, undefined)}
          className={`absolute right-0 bottom-0 h-8 w-8 cursor-nwse-resize touch-none items-center justify-center rounded-full border border-outline-variant bg-surface-container-highest text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary-container hidden md:flex`}
        >
          <MoveDiagonal2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}
