'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface PopoverTriggerProps {
  'aria-expanded': boolean
  'aria-controls': string
  'aria-haspopup': 'dialog'
  onClick: () => void
}

// An anchored panel rendered in place (not portalled), so it inherits CSS
// custom properties from where it sits — e.g. a workspace's --ws-accent,
// which Modal (portalled to <body>) can't see. Closes on Escape and on a
// click outside. Works controlled (open + onOpenChange) or uncontrolled.
export default function Popover({
  trigger,
  children,
  open: controlledOpen,
  onOpenChange,
  align = 'start',
  label,
  className = '',
  panelClassName = '',
}: {
  trigger: (props: PopoverTriggerProps) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'end'
  label: string
  className?: string
  panelClassName?: string
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const panelId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [controlledOpen, onOpenChange]
  )

  const close = useCallback(() => setOpen(false), [setOpen])

  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) close()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      const triggerEl = wrapperRef.current?.querySelector<HTMLElement>('[aria-haspopup="dialog"]')
      triggerEl?.focus()
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, close])

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {trigger({
        'aria-expanded': open,
        'aria-controls': panelId,
        'aria-haspopup': 'dialog',
        onClick: () => setOpen(!open),
      })}
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-40 mt-2 w-max max-w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-outline-variant bg-surface-container-low p-3 text-on-surface shadow-2xl shadow-black/50 ${
            align === 'end' ? 'right-0' : 'left-0'
          } ${panelClassName}`}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}
