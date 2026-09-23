'use client'

import { useMemo } from 'react'
import { Eye, EyeOff, GripVertical, Settings2 } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { QuickLink } from '@/lib/types'
import { ACCENT_TEXT } from '@/lib/theme'
import { onActivateKey } from '@/lib/utils/a11y'
import Popover from '../../Popover'
import FaviconTile from './FaviconTile'

// Drag reordering is scoped to a small handle, following the same pattern
// as HabitCard.tsx: `useSortable`, listeners on the handle only, so the
// row's own toggle button doesn't compete with dnd-kit's pointer sensor.
function SelectedRow({ link, onToggle }: { link: QuickLink; onToggle: (linkId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const style = {
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
    transition: transition ?? undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 ${isDragging ? 'z-10 bg-surface-container-high opacity-80' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${link.title}`}
        className="shrink-0 touch-none cursor-grab rounded p-1 text-on-surface-variant/40 hover:bg-surface-container-high hover:text-on-surface-variant active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <FaviconTile
        title={link.title}
        url={link.url}
        faviconPath={link.favicon_path}
        faviconCustomUrl={link.favicon_custom_url}
        size="sm"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{link.title}</span>
      <button
        type="button"
        role="switch"
        aria-checked
        onClick={() => onToggle(link.id)}
        aria-label={`Remove ${link.title} from the launcher`}
        className="shrink-0 rounded p-1 text-on-surface hover:bg-surface-container-high"
      >
        <Eye className="h-4 w-4" />
      </button>
    </li>
  )
}

// Not on the launcher yet — the whole row is the click target (role=switch
// + tabIndex, per onActivateKey's guard that Enter/Space only fires when
// the row itself has focus, not from a nested control).
function UnselectedRow({ link, onToggle }: { link: QuickLink; onToggle: (linkId: string) => void }) {
  return (
    <li
      role="switch"
      aria-checked={false}
      tabIndex={0}
      onClick={() => onToggle(link.id)}
      onKeyDown={onActivateKey(() => onToggle(link.id))}
      aria-label={`Add ${link.title} to the launcher`}
      className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 hover:bg-surface-container-high"
    >
      <span className="w-3.5 shrink-0" aria-hidden />
      <FaviconTile
        title={link.title}
        url={link.url}
        faviconPath={link.favicon_path}
        faviconCustomUrl={link.favicon_custom_url}
        size="sm"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-on-surface-variant">{link.title}</span>
      <span className="shrink-0 rounded p-1 text-on-surface-variant/50">
        <EyeOff className="h-4 w-4" />
      </span>
    </li>
  )
}

/**
 * The launcher's "choose which apps appear and reorder them" menu — every
 * quick_link with a visibility toggle, plus drag-to-reorder for the
 * selected ones. `selectedIds` is already resolved (stale ids dropped,
 * see lib/app-launcher/launcher-selection.ts) and in display order.
 */
export default function LauncherMenu({
  links,
  selectedIds,
  onToggle,
  onReorder,
}: {
  links: QuickLink[]
  selectedIds: string[]
  onToggle: (linkId: string) => void
  onReorder: (activeId: string, overId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const linksById = useMemo(() => new Map(links.map((link) => [link.id, link])), [links])
  const selectedLinks = useMemo(
    () => selectedIds.map((id) => linksById.get(id)).filter((link): link is QuickLink => Boolean(link)),
    [selectedIds, linksById]
  )
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const unselectedLinks = useMemo(() => links.filter((link) => !selectedIdSet.has(link.id)), [links, selectedIdSet])

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onReorder(String(active.id), String(over.id))
  }

  return (
    <Popover
      label="Choose launcher apps"
      align="end"
      panelClassName="w-72"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label="Choose launcher apps"
          className={`transition-transform duration-300 hover:translate-x-0.5 hover:-translate-y-0.5 ${ACCENT_TEXT.neutral}`}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      )}
    >
      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
        {links.length === 0 ? (
          <p className="px-1 text-xs text-on-surface-variant">No links yet — add some from the App Library.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="label-caps px-1 text-on-surface-variant">On the launcher</span>
              {selectedLinks.length === 0 ? (
                <p className="px-1.5 text-xs text-on-surface-variant">Nothing selected yet — add some below.</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={selectedLinks.map((link) => link.id)} strategy={verticalListSortingStrategy}>
                    <ul className="flex flex-col gap-0.5">
                      {selectedLinks.map((link) => (
                        <SelectedRow key={link.id} link={link} onToggle={onToggle} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>
            {unselectedLinks.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-outline-variant pt-2">
                <span className="label-caps px-1 text-on-surface-variant">Not shown</span>
                <ul className="flex flex-col gap-0.5">
                  {unselectedLinks.map((link) => (
                    <UnselectedRow key={link.id} link={link} onToggle={onToggle} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Popover>
  )
}
