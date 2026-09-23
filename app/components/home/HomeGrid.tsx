'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
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
import { useSettings } from '@/lib/settings/use-settings'
import {
  defaultHomeLayout,
  hiddenWidgets,
  homeWidgetLabel,
  isDefaultLayout,
  reorderLayout,
  resolveHomeLayout,
  setWidgetHidden,
  setWidgetSpan,
  visibleWidgets,
  type HomeLayoutEntry,
  type HomeWidgetSpan,
} from '@/lib/home/layout'
import HomeWidgetFrame from './HomeWidgetFrame'
import { homeWidgetComponent } from './widget-registry'

/**
 * The home bento grid: widget order, column spans and visibility, saved per
 * user in `user_settings.home_layout`.
 *
 * Height is deliberately *not* fixed. `auto-rows-min` plus `items-start`
 * means a card is as tall as its own content and no taller — resizing
 * changes width only. The one persisted knob is the column span.
 *
 * State model: `saved` is what the settings row says; `pending` is the
 * in-flight arrangement (only set while a resize is being dragged, or for
 * the moment between an optimistic write and it landing). Rendering reads
 * `pending ?? saved`, so a failed write rolls back to exactly what the
 * server still holds — `useSettings` already restores the previous value
 * and surfaces `error`.
 */
export default function HomeGrid() {
  const { settings, error, updateSettings } = useSettings()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<HomeLayoutEntry[] | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const saved = useMemo(() => resolveHomeLayout(settings.home_layout), [settings.home_layout])
  const layout = pending ?? saved
  const visible = useMemo(() => visibleWidgets(layout), [layout])
  const hidden = useMemo(() => hiddenWidgets(layout), [layout])

  const persist = useCallback(
    async (next: HomeLayoutEntry[]) => {
      // Show it immediately, then let useSettings' own optimistic update
      // take over. Clearing `pending` only after the write settles keeps
      // the grid from flashing back through the old arrangement.
      setPending(next)
      await updateSettings({ home_layout: next })
      setPending(null)
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
  const handleSpanPreview = useCallback(
    (id: string, span: HomeWidgetSpan) => {
      setPending(setWidgetSpan(layout, id, span))
    },
    [layout]
  )

  const handleSpanCommit = useCallback(
    (id: string, span: HomeWidgetSpan) => {
      void persist(setWidgetSpan(layout, id, span))
    },
    [layout, persist]
  )

  const handleReset = useCallback(() => {
    void persist(defaultHomeLayout())
  }, [persist])

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex min-h-8 items-center justify-end gap-2">
        {editing ? (
          <>
            <span className="label-caps mr-auto text-on-surface-variant">Arranging home</span>
            <Button variant="quiet" size="sm" onClick={handleReset} disabled={isDefaultLayout(layout)}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
          </>
        ) : (
          <Button variant="quiet" size="sm" onClick={() => setEditing(true)} title="Reorder, resize and hide widgets">
            <LayoutGrid className="h-3.5 w-3.5" />
            Customise
          </Button>
        )}
      </div>

      {editing && error ? (
        <p className="body-sm text-error" role="status">
          Couldn&apos;t save your layout: {error}
        </p>
      ) : null}

      {editing && hidden.length > 0 ? (
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
            className="grid flex-1 auto-rows-min grid-cols-1 items-start gap-card-gap sm:grid-cols-2 xl:grid-cols-4"
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
                  editing={editing}
                  gridRef={gridRef}
                  onHide={handleHide}
                  onSpanPreview={handleSpanPreview}
                  onSpanCommit={handleSpanCommit}
                >
                  <Widget span={entry.span} />
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
