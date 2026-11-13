'use client'

import { useState } from 'react'
import { ChevronDown, Megaphone } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { CountBadge } from '@/components/ui/count-badge'
import { useAnnouncements } from '@/lib/blackboard/use-announcements'
import type { Accent } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'
import AnnouncementEntry from './AnnouncementEntry'

/**
 * /lectures' one running list of announcements, every module, newest first.
 * Collapsed by default, below the work list: an extra notification, never the
 * thing to look at first. The header carries the unread count. Mounted once.
 * Renders nothing until there is at least one announcement.
 */
export default function AnnouncementsSection({ accent }: { accent: Accent }) {
  const { announcements, unread, loading, error, markRead } = useAnnouncements()
  const [open, setOpen] = useState(false)
  const [now] = useState(() => new Date())

  if (loading || (announcements.length === 0 && !error)) return null

  return (
    <ModuleGlassCard accent={accent} size="sm" className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
      >
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-on-surface">
          <Megaphone className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
          Announcements
          <CountBadge count={announcements.length} />
          {unread > 0 && (
            <span className="text-[11px] font-normal text-on-surface-variant">{unread} unread</span>
          )}
        </h2>
        <ChevronDown
          className={cn('h-4 w-4 text-on-surface-variant transition-transform', open && 'rotate-180')}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>
      {error && (
        <p role="alert" className="text-xs text-error">
          Couldn’t load announcements: {error}
        </p>
      )}
      {open && (
        <ul className="flex flex-col gap-0.5">
          {announcements.map((a) => (
            <AnnouncementEntry key={a.id} announcement={a} now={now} showSource onOpen={(id) => void markRead(id)} />
          ))}
        </ul>
      )}
    </ModuleGlassCard>
  )
}
