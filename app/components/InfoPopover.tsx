'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import Popover from './Popover'

// An (i) button that opens an anchored explanation panel — for "how does
// this page work" help that shouldn't take permanent space on the page.
export default function InfoPopover({
  label,
  align = 'start',
  children,
}: {
  label: string
  align?: 'start' | 'end'
  children: ReactNode
}) {
  return (
    <Popover
      label={label}
      align={align}
      panelClassName="w-[min(28rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto p-4"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={label}
          className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface aria-expanded:bg-surface-container-high aria-expanded:text-on-surface"
        >
          <Info className="h-4 w-4" strokeWidth={1.75} />
        </button>
      )}
    >
      {children}
    </Popover>
  )
}
