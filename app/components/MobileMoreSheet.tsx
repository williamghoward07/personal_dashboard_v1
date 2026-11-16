'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { ACCENT_TEXT, MODULE_ACCENT } from '@/lib/theme'
import { isNavItemActive, type NavItem } from '@/lib/nav-items'

/**
 * Bottom sheet listing the nav items that don't fit in the phone bar.
 * A native <dialog> gives focus trapping, Escape and a backdrop for free.
 */
export default function MobileMoreSheet({
  items,
  pathname,
  onClose,
}: {
  items: NavItem[]
  pathname: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label="More"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none bg-transparent p-0 text-on-surface backdrop:bg-black/60"
    >
      <div
        className={`rounded-t-2xl border-t border-outline-variant bg-surface-container-lowest px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 transition-[transform,opacity] duration-200 ease-out motion-reduce:translate-y-0 ${
          shown ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 motion-reduce:opacity-0'
        }`}
      >
        <div className="flex h-12 items-center justify-between px-3">
          <h2 className="font-display text-sm font-semibold tracking-wide">More</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-on-surface-variant"
          >
            <X aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </button>
        </div>
        <ul className="flex flex-col overflow-y-auto">
          {items.map((item) => {
            const { href, label, icon: Icon, module } = item
            const active = isNavItemActive(item, pathname)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 font-display text-sm font-semibold ${
                    active
                      ? `bg-surface-container-high ${ACCENT_TEXT[MODULE_ACCENT[module]]}`
                      : 'text-on-surface'
                  }`}
                >
                  <Icon aria-hidden className="h-6 w-6 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </dialog>
  )
}
