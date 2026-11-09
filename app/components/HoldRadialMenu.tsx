'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { ACCENT_SOLID, ACCENT_TEXT, type UiAccent } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import { radialIndex, radialPosition } from '@/lib/ui/radial'

export interface RadialItem<T> {
  value: T
  label: string
}

export interface HoldRadialTriggerProps {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: () => void
  onContextMenu: (e: ReactMouseEvent<HTMLElement>) => void
  onClick: (e: ReactMouseEvent<HTMLElement>) => void
}

const RADIUS = 76
const DEADZONE = 26

/**
 * A press-and-hold radial menu (the game "weapon wheel"). A quick click
 * does whatever `onClick` does; holding for `holdMs` opens a wheel of
 * `items` round the trigger, and releasing over one picks it. Releasing
 * near the centre, or pressing Escape, cancels. Rendered in place (not
 * portalled), so `accent="ws"` follows the workspace's --ws-accent.
 */
export default function HoldRadialMenu<T>({
  items,
  onPick,
  onClick,
  onOpenChange,
  holdMs = 250,
  accent = 'ws',
  hint = 'Release to pick',
  children,
}: {
  items: readonly RadialItem<T>[]
  onPick: (value: T) => void
  /** The trigger's ordinary click; skipped after a hold. */
  onClick?: () => void
  onOpenChange?: (open: boolean) => void
  holdMs?: number
  accent?: UiAccent
  hint?: string
  children: (props: HoldRadialTriggerProps) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const centre = useRef({ x: 0, y: 0 })
  // A hold ends in a pointerup that the browser follows with a click.
  const swallowClick = useRef(false)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const close = () => {
    clearTimer()
    setOpen(false)
    setActive(null)
    onOpenChange?.(false)
  }

  useEffect(() => clearTimer, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        swallowClick.current = true
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // close is stable enough for a listener that only lives while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const trigger: HoldRadialTriggerProps = {
    onPointerDown: (e) => {
      if (e.button !== 0) return
      swallowClick.current = false
      const rect = e.currentTarget.getBoundingClientRect()
      centre.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      // Keep receiving moves and the release even off the button.
      e.currentTarget.setPointerCapture?.(e.pointerId)
      clearTimer()
      timer.current = setTimeout(() => {
        timer.current = null
        swallowClick.current = true
        setOpen(true)
        onOpenChange?.(true)
      }, holdMs)
    },
    onPointerMove: (e) => {
      if (!open) return
      setActive(radialIndex(e.clientX - centre.current.x, e.clientY - centre.current.y, items.length, DEADZONE))
    },
    onPointerUp: (e) => {
      if (!open) {
        clearTimer()
        return
      }
      const index = radialIndex(e.clientX - centre.current.x, e.clientY - centre.current.y, items.length, DEADZONE)
      close()
      if (index !== null) onPick(items[index].value)
    },
    onPointerCancel: close,
    // A long press on a trackpad or touch screen would open the context menu.
    onContextMenu: (e) => {
      if (open || timer.current) e.preventDefault()
    },
    onClick: (e) => {
      if (swallowClick.current) {
        swallowClick.current = false
        e.preventDefault()
        return
      }
      onClick?.()
    },
  }

  return (
    <div className="relative w-fit">
      {/* The handlers only touch refs when they fire, never during render. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {children(trigger)}
      {open && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ width: RADIUS * 2 + 64, height: RADIUS * 2 + 64 }}
        >
          <div className="radial-in absolute inset-0 rounded-full border border-outline-variant bg-surface-container-low/90 shadow-2xl shadow-black/50 backdrop-blur-md" />
          <div className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-center text-[10px] leading-tight text-on-surface-variant">
            {active === null ? (
              <span className="px-1">{hint}</span>
            ) : (
              <span className={cn('font-semibold', ACCENT_TEXT[accent])}>{items[active].label}</span>
            )}
          </div>
          {items.map((item, i) => {
            const { x, y } = radialPosition(i, items.length, RADIUS)
            const isActive = i === active
            return (
              <span
                key={item.label}
                className={cn(
                  'absolute top-1/2 left-1/2 flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums transition-transform duration-[var(--duration-fast)] motion-reduce:transition-none',
                  isActive ? ACCENT_SOLID[accent] : 'bg-surface-container-high text-on-surface'
                )}
                style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))${isActive ? ' scale(1.15)' : ''}` }}
              >
                {item.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
