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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-black/10 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-[#1a1a19]"
      >
        {children}
      </div>
    </div>
  )
}
