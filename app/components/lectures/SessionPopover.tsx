'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { SessionWithPrep } from '@/lib/timetable/session'
import { anchorPanelPosition } from '@/lib/ui/anchor-position'
import ConnectedSessionPrep from './ConnectedSessionPrep'

// Opening a timetable session from anywhere in the calendar: renderers call
// useOpenSession()(session, element) and the provider shows that session's
// prep panel anchored beside the element (a bottom sheet on narrow
// screens) — never a full-screen modal. A context, so the eight calendar
// renderers don't each thread an onSelectSession prop.
//
// Portalled with fixed positioning because the week/day grids scroll and
// clip; the calendar has no --ws-accent for an in-place panel to inherit.

type OpenSession = (session: SessionWithPrep, anchor: HTMLElement) => void

const OpenSessionContext = createContext<OpenSession | null>(null)

export function useOpenSession(): OpenSession | null {
  return useContext(OpenSessionContext)
}

const PANEL_WIDTH = 360
const SHEET_BREAKPOINT = 640

export function SessionPopoverProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ session: SessionWithPrep; anchor: HTMLElement } | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [sheet, setSheet] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const openSession = useCallback<OpenSession>((session, anchor) => {
    setPosition(null)
    setOpen({ session, anchor })
  }, [])
  const close = useCallback(() => {
    open?.anchor.focus()
    setOpen(null)
  }, [open])

  // Place the panel once it has rendered (its height is only known then),
  // and again whenever it resizes — readings load in after it opens.
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
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || open.anchor.contains(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // The anchor moves with any scroll outside the panel, so close then.
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return
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
    <OpenSessionContext.Provider value={openSession}>
      {children}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`${open.session.type}: ${open.session.moduleName}`}
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
            <ConnectedSessionPrep key={open.session.uid} session={open.session} />
          </div>,
          document.body
        )}
    </OpenSessionContext.Provider>
  )
}
