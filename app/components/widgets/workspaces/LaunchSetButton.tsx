'use client'

import { useState } from 'react'
import { ExternalLink, Rocket, X } from 'lucide-react'
import type { WorkspaceLink } from '@/lib/types'
import { launchLinks, openOne } from '@/lib/workspaces/launch'
import Popover from '../../Popover'
import { actionButtonClass, primaryButtonClass } from './shared'

// "Launch set": opens every source in its own tab. Pop-up blockers usually
// let only the first tab through per click, so any blocked ones are kept
// in a queue with a one-click-per-tab stepper, alongside how to allow
// pop-ups for the site so the next launch opens them all at once.
export default function LaunchSetButton({ links }: { links: WorkspaceLink[] }) {
  const [queue, setQueue] = useState<string[]>([])
  const [total, setTotal] = useState(0)

  const launch = () => {
    const urls = links.map((l) => l.url)
    const { blocked } = launchLinks(urls)
    setTotal(urls.length)
    setQueue(blocked)
  }

  const openNext = () => {
    const [next, ...rest] = queue
    if (!next) return
    if (openOne(next)) setQueue(rest)
  }

  const opened = total - queue.length

  return (
    <Popover
      label="Blocked tabs"
      align="end"
      open={queue.length > 0}
      onOpenChange={(open) => {
        if (!open) setQueue([])
      }}
      panelClassName="w-80"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          // The panel only opens when something was blocked, never on click.
          onClick={launch}
          disabled={links.length === 0}
          className={primaryButtonClass}
        >
          <Rocket className="h-3.5 w-3.5" strokeWidth={1.75} />
          Launch set ({links.length})
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-on-surface">
              Your browser blocked {queue.length} of {total} tabs
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Dismiss"
              className="rounded p-0.5 text-on-surface-variant hover:text-on-surface"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="leading-relaxed text-on-surface-variant">
            To open the whole set in one click next time, click the blocked pop-up icon at the right of the address
            bar and choose <span className="text-on-surface">Always allow pop-ups</span> for this site, then launch
            again.
          </p>
          <button type="button" onClick={openNext} className={actionButtonClass}>
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            Open next ({opened + 1} of {total})
          </button>
        </div>
      )}
    </Popover>
  )
}
