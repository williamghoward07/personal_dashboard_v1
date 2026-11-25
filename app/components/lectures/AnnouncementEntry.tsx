'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { announcementSource, excerpt, postedDayLabel, type AnnouncementView } from '@/lib/blackboard/announcements'
import { ACCENT_BAR, ACCENT_TEXT } from '@/lib/theme'
import { cn } from '@/lib/utils/cn'

/**
 * One announcement, shown in the corner chip's popover and in /lectures'
 * running section: title, posted day, a short excerpt, and "Open on
 * Blackboard". Opening it (expanding the text, or following the link) marks
 * it read. The only place an announcement's row is drawn.
 */
export default function AnnouncementEntry({
  announcement,
  now,
  showSource,
  onOpen,
}: {
  announcement: AnnouncementView
  now: Date
  /** The module code (or course name), for lists that span modules. */
  showSource: boolean
  onOpen: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const day = postedDayLabel(announcement.postedAt, now)
  const short = excerpt(announcement.bodyText)
  const hasMore = announcement.bodyText.replace(/\s+/g, ' ').trim().length > short.length

  const toggle = () => {
    setExpanded((v) => !v)
    onOpen(announcement.id)
  }

  return (
    <li className="flex flex-col gap-1 rounded-lg px-1 py-1.5 hover:bg-surface-container-high/50">
      <div className="flex items-center gap-2">
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', announcement.read ? 'bg-transparent' : ACCENT_BAR.blue)}
          aria-hidden
        />
        {!announcement.read && <span className="sr-only">Unread</span>}
        {showSource && (
          <span className="shrink-0 font-mono text-[11px] text-on-surface-variant">{announcementSource(announcement)}</span>
        )}
        <span
          className={cn('min-w-0 flex-1 truncate text-sm', announcement.read ? 'text-on-surface-variant' : 'font-semibold text-on-surface')}
          title={announcement.title}
        >
          {announcement.title}
        </span>
        {day && <span className="shrink-0 text-[11px] text-on-surface-variant">{day}</span>}
      </div>
      {short && (
        <p className={cn('pl-4 text-xs text-on-surface-variant', expanded && 'max-h-60 overflow-y-auto whitespace-pre-line')}>
          {expanded ? announcement.bodyText.trim() : short}
        </p>
      )}
      <div className="flex items-center gap-3 pl-4">
        {hasMore && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={toggle}
            className="rounded-sm text-[11px] text-on-surface-variant hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
          >
            {expanded ? 'Show less' : 'Show all'}
          </button>
        )}
        {announcement.url && (
          <a
            href={announcement.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen(announcement.id)}
            className={cn('inline-flex items-center gap-1 text-xs font-semibold hover:underline', ACCENT_TEXT.blue)}
          >
            Open on Blackboard
            <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
          </a>
        )}
        {!hasMore && !announcement.read && (
          <button
            type="button"
            onClick={() => onOpen(announcement.id)}
            className="rounded-sm text-[11px] text-on-surface-variant hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
          >
            Mark read
          </button>
        )}
      </div>
    </li>
  )
}
