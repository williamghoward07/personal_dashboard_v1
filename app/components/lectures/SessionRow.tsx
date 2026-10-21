'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatSessionDay, formatSessionTime } from '@/lib/timetable/format'
import type { PrepStatus, ReadingCount, TimetableSession } from '@/lib/timetable/session'
import PrepLight from './PrepLight'

/**
 * One session as a row — light · day · time · type · readings — that
 * expands in place to show its prep panel (`children`).
 */
export default function SessionRow({
  session,
  status,
  readings,
  notesDone,
  showModule = false,
  expanded,
  onToggle,
  children,
}: {
  session: Pick<TimetableSession, 'uid' | 'type' | 'moduleCode' | 'moduleName' | 'start' | 'end' | 'location'>
  status: PrepStatus
  readings: ReadingCount
  notesDone: boolean
  showModule?: boolean
  expanded: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <li className={cn('rounded-lg border', expanded ? 'border-outline-variant bg-surface-container-low/60' : 'border-transparent')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-container-high/60"
      >
        <PrepLight status={status} notesDone={notesDone} />
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
          {readings.total > 0 ? `${readings.done}/${readings.total} read` : ''}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform', expanded ? '' : '-rotate-90')}
          aria-hidden
        />
      </button>
      {expanded && <div className="px-3 pt-1 pb-3">{children}</div>}
    </li>
  )
}
