'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Check, Eye, LayoutGrid, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  HOME_GRID_COLUMNS,
  defaultHomeLayout,
  hiddenWidgets,
  homeWidgetLabel,
  isDefaultLayout,
  reorderLayout,
  resolveHomeLayout,
  setWidgetHidden,
  setWidgetHeight,
  setWidgetSpan,
  studyHomeLayout,
  visibleWidgets,
  type HomeLayoutEntry,
  type HomeWidgetSpan,
} from '@/lib/home/layout'
import { useAppSettings } from '../settings/SettingsProvider'
import HomeWidgetFrame from './HomeWidgetFrame'
import { homeWidgetComponent } from './widget-registry'

/**
 * The home bento grid: widget order, column spans and visibility, saved per
 * user in `user_settings.home_layout`.
 *
 * Height is deliberately *not* fixed. `items-start` means a card is as tall
 * as its own content and no taller, and 1px implicit rows (no row gap) let
 * each frame span its measured height so cards pack masonry-style instead of
 * leaving a gap under short cards. Resizing sets the column span and, optionally,
 * a height that stretches the card. The launcher uses that height setting
 * to choose how many rows of apps to show and sizes to its content.
 *
 * State model: `saved` is what the settings row says; `pending` is the
 * in-flight arrangement (only set while a resize is being dragged, or for
 * the moment between an optimistic write and it landing). Rendering reads
 * `pending ?? saved`, so a failed write rolls back to exactly what the
 * server still holds — `useSettings` already restores the previous value
 * and surfaces `error`.
 */
export default function HomeGrid({ heading, query }: { heading: ReactNode; query: ReactNode }) {
  const { settings, error, updateSettings } = useAppSettings()
  const [editing, setEditing] = useState(false)
  const [previewingStudyLayout, setPreviewingStudyLayout] = useState(false)
  const [pending, setPending] = useState<HomeLayoutEntry[] | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [gridColumns, setGridColumns] = useState(HOME_GRID_COLUMNS)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const observer = new ResizeObserver(() => {
      const tracks = window.getComputedStyle(grid).gridTemplateColumns.trim()
      if (tracks) setGridColumns(tracks.split(/\s+/).length)
    })
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  const saved = useMemo(() => resolveHomeLayout(settings.home_layout), [settings.home_layout])
  const currentLayout = pending ?? saved
  const layout = useMemo(
    () => previewingStudyLayout ? studyHomeLayout(currentLayout) : currentLayout,
    [currentLayout, previewingStudyLayout],
  )
  const visible = useMemo(() => visibleWidgets(layout), [layout])
  const hidden = useMemo(() => hiddenWidgets(layout), [layout])

  const persist = useCallback(
    async (next: HomeLayoutEntry[]) => {
      // Show it immediately, then let useSettings' own optimistic update
      // take over. Clearing `pending` only after the write settles keeps
      // the grid from flashing back through the old arrangement.
      setPending(next)
      await updateSettings({ home_layout: next })
      setPending((current) => current === next ? null : current)
    },
    [updateSettings]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      void persist(reorderLayout(layout, String(active.id), String(over.id)))
    },
    [layout, persist]
  )

  const handleHide = useCallback(
    (id: string) => {
      void persist(setWidgetHidden(layout, id, true))
    },
    [layout, persist]
  )

  const handleRestore = useCallback(
    (id: string) => {
      void persist(setWidgetHidden(layout, id, false))
    },
    [layout, persist]
  )

  // Dragging the corner only touches local state; the write happens once,
  // on release, rather than on every pointer move.
  const handleSizePreview = useCallback(
    (id: string, span: HomeWidgetSpan, height: number | undefined) => {
      setPending(setWidgetHeight(setWidgetSpan(layout, id, span), id, height))
    },
    [layout]
  )

  const handleSizeCommit = useCallback(
    (id: string, span: HomeWidgetSpan, height: number | undefined) => {
      void persist(setWidgetHeight(setWidgetSpan(layout, id, span), id, height))
    },
    [layout, persist]
  )

  const handleReset = useCallback(() => {
    void persist(defaultHomeLayout())
  }, [persist])

  return (
    <div className="flex flex-1 flex-col gap-3">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(16rem,32rem)_auto]">
        <div className="col-start-1 row-start-1">{heading}</div>
        <div className="col-span-2 col-start-1 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">{query}</div>
        {!editing && (
          <Button variant="quiet" size="sm" className="col-start-2 row-start-1 md:col-start-3" onClick={() => setEditing(true)} title="Reorder, resize and hide widgets">
            <LayoutGrid className="h-3.5 w-3.5" />
            Customise
          </Button>
        )}
      </header>

      {editing && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {previewingStudyLayout ? (
            <>
              <span className="mr-auto text-xs text-on-surface-variant">Previewing Study layout</span>
              <Button variant="quiet" size="sm" onClick={() => setPreviewingStudyLayout(false)}>Cancel</Button>
              <Button variant="secondary" size="sm" onClick={() => {
                setPreviewingStudyLayout(false)
                void persist(layout)
              }}>Apply layout</Button>
            </>
          ) : <>
            <span className="label-caps mr-auto text-on-surface-variant">Arranging home</span>
            <Button variant="quiet" size="sm" onClick={() => setPreviewingStudyLayout(true)}>
              Study layout
            </Button>
            <Button variant="quiet" size="sm" onClick={handleReset} disabled={isDefaultLayout(layout)}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
          </>}
        </div>
      )}

      {editing && error ? (
        <p className="body-sm text-error" role="status">
          Couldn&apos;t save your layout: {error}
        </p>
      ) : null}

      {editing && !previewingStudyLayout && hidden.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-outline-variant p-3">
          <span className="label-caps text-on-surface-variant">Hidden</span>
          {hidden.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleRestore(entry.id)}
              className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary-container"
            >
              <Eye className="h-3 w-3" />
              {homeWidgetLabel(entry.id)}
            </button>
          ))}
        </div>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible.map((entry) => entry.id)} strategy={rectSortingStrategy}>
          <div
            ref={gridRef}
            className="grid flex-1 auto-rows-[1px] grid-cols-1 items-start gap-x-card-gap gap-y-0 sm:grid-cols-2 xl:grid-cols-4"
          >
            {visible.map((entry) => {
              const Widget = homeWidgetComponent(entry.id)
              if (!Widget) return null
              return (
                <HomeWidgetFrame
                  key={entry.id}
                  id={entry.id}
                  label={homeWidgetLabel(entry.id)}
                  span={entry.span}
                  height={entry.height}
                  editing={editing && !previewingStudyLayout}
                  gridRef={gridRef}
                  gridColumns={gridColumns}
                  onHide={handleHide}
                  onSizePreview={handleSizePreview}
                  onSizeCommit={handleSizeCommit}
                >
                  <Widget span={Math.min(entry.span, gridColumns) as HomeWidgetSpan} height={entry.height} />
                </HomeWidgetFrame>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {visible.length === 0 ? (
        <p className="body-sm text-on-surface-variant">
          Every widget is hidden. {editing ? 'Pick one above to bring it back.' : 'Use Customise to bring one back.'}
        </p>
      ) : null}
    </div>
  )
}
