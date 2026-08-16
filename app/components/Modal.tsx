'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'

export default function Modal({
  onClose,
  children,
}: {
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Stops the click from bubbling past the backdrop — matters now
        // that a modal can be rendered inside a clickable ancestor (e.g.
        // CalendarModule's home-page Link): without this, dismissing the
        // modal by clicking outside it would also trigger the ancestor's
        // click behaviour.
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-low p-5 text-on-surface shadow-2xl shadow-black/50"
      >
        {children}
      </div>
    </div>
  )
}
