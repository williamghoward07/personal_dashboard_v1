'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useWorkItems } from '@/lib/blackboard/use-work-items'
import { WORK_CATEGORY_LABEL, type WorkItem } from '@/lib/blackboard/work'
import { anchorPanelPosition } from '@/lib/ui/anchor-position'
import { cn } from '@/lib/utils/cn'
import WorkRow from '../lectures/WorkRow'
import { moduleNameMap } from '../lectures/module-names'
import { DEADLINE_DONE_CLASS, deadlineTime } from './calendarItems'

// Opening a Blackboard deadline from anywhere in the calendar, the same way
// SessionPopover opens a timetable session: renderers call
// useOpenDeadline()(item, element) and the provider shows the item's WorkRow
// anchored beside the element (a bottom sheet on narrow screens), never a
// full-screen modal. Positioning is the shared anchorPanelPosition.

type OpenDeadline = (item: WorkItem, anchor: HTMLElement) => void

const OpenDeadlineContext = createContext<OpenDeadline | null>(null)

export function useOpenDeadline(): OpenDeadline | null {
  return useContext(OpenDeadlineContext)
}

const PANEL_WIDTH = 360
const SHEET_BREAKPOINT = 640

// The panel's content. It reads the live item by key, so confirming, editing
// or ticking it done shows straight away; the clicked item covers loading.
function DeadlinePanel({ item }: { item: WorkItem }) {
  const { items } = useWorkItems()
  const [now] = useState(() => new Date())
  const names = useMemo(() => moduleNameMap(items), [items])
  const live = items.find((i) => i.key === item.key) ?? item
  const moduleName = live.moduleCode ? names.get(live.moduleCode) : null
  const header = [live.moduleCode, moduleName].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-2">
      <p className="pr-6 text-xs font-semibold text-on-surface-variant">
        {header ? `${header} · ` : ''}
        {WORK_CATEGORY_LABEL[live.category]}
      </p>
      <WorkRow item={live} now={now} accent="orange" showModule={false} compact />
    </div>
  )
}

export function DeadlinePopoverProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ item: WorkItem; anchor: HTMLElement } | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [sheet, setSheet] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const openDeadline = useCallback<OpenDeadline>((item, anchor) => {
    setPosition(null)
    setOpen({ item, anchor })
  }, [])
  const close = useCallback(() => {
    open?.anchor.focus()
    setOpen(null)
  }, [open])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    const place = () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const isSheet = viewport.width < SHEET_BREAKPOINT
      setSheet(isSheet)
      if (!isSheet) {
        const rect = open.anchor.getBoundingClientRect()
        setPosition(anchorPanelPosition(rect, { width: PANEL_WIDTH, height: panel.offsetHeight }, viewport))
      }
    }
    const observer = new ResizeObserver(place)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    if (!open) return
    // WorkRow opens its own dialogs (dismiss confirmation) in a portal:
    // pointer and Escape events in those belong to them, not to this panel.
    const inOtherDialog = (node: Node | null) => {
      const dialog = (node as Element | null)?.closest?.('[role="dialog"], [role="alertdialog"]')
      return !!dialog && dialog !== panelRef.current
    }
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || open.anchor.contains(target) || inOtherDialog(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length <= 1) close()
    }
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node) || inOtherDialog(e.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  return (
    <OpenDeadlineContext.Provider value={openDeadline}>
      {children}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={open.item.title}
            style={
              sheet
                ? undefined
                : { top: position?.top ?? 0, left: position?.left ?? 0, width: PANEL_WIDTH, visibility: position ? 'visible' : 'hidden' }
            }
            className={
              sheet
                ? 'fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-outline-variant bg-surface-container-low p-4 text-on-surface shadow-2xl shadow-black/50'
                : 'fixed z-50 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-low p-4 text-on-surface shadow-2xl shadow-black/50'
            }
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-2 right-2 rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <DeadlinePanel key={open.item.key} item={open.item} />
          </div>,
          document.body
        )}
    </OpenDeadlineContext.Provider>
  )
}

/** A deadline's clickable "14:00 Title" label, struck through once done. */
export function DeadlineButton({ item, className }: { item: WorkItem; className?: string }) {
  const openDeadline = useOpenDeadline()
  const time = deadlineTime(item)
  return (
    <button
      type="button"
      onClick={(e) => openDeadline?.(item, e.currentTarget)}
      title={item.title}
      className={cn('truncate text-left', item.done && DEADLINE_DONE_CLASS, className)}
    >
      {time && <span className="mr-1 tabular-nums">{time}</span>}
      {item.title}
    </button>
  )
}
