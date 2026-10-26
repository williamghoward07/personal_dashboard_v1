'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatSessionDay, formatSessionTime, sessionHref } from '@/lib/timetable/format'
import type { PostStatus, PrepStatus, ReadingCount, TimetableSession } from '@/lib/timetable/session'
import PrepLight from './PrepLight'

/**
 * One session as a row — light · day · time · type · prep ticked — that
 * opens its assignment view. `aside` sits before the chevron (the overdue
 * list's badge); `action` sits outside the link (a quick button).
 */
export default function SessionRow({
  session,
  status,
  postStatus,
  prep,
  showModule = false,
  aside,
  action,
}: {
  session: Pick<TimetableSession, 'uid' | 'type' | 'moduleCode' | 'moduleName' | 'start' | 'end' | 'location'>
  status: PrepStatus
  postStatus: PostStatus
  /** Readings + prep tasks. */
  prep: ReadingCount
  showModule?: boolean
  aside?: ReactNode
  action?: ReactNode
}) {
  return (
    <li className="flex items-center gap-2">
      <Link
        href={sessionHref(session.uid)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-container-high/60"
      >
        <PrepLight status={status} postStatus={postStatus} />
        <span className="w-20 shrink-0 text-xs text-on-surface-variant">{formatSessionDay(session.start)}</span>
        <span className="w-24 shrink-0 font-mono text-[11px] tabular-nums text-on-surface-variant">
          {formatSessionTime(session)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
          {showModule ? (
            <>
              <span className="font-mono text-[11px] text-on-surface-variant">{session.moduleCode ?? '—'}</span>{' '}
              {session.moduleName} · {session.type}
            </>
          ) : (
            session.type
          )}
        </span>
        {session.location && (
          <span className="hidden shrink-0 text-xs text-on-surface-variant md:inline">{session.location}</span>
        )}
        <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-on-surface-variant">
          {prep.total > 0 ? `${prep.done}/${prep.total} prep` : ''}
        </span>
        {aside}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-hidden />
      </Link>
      {action}
    </li>
  )
}
