'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { CalendarClock, BookOpen, Check, EyeOff, ExternalLink, FileText, Megaphone, Pin, Presentation, Sparkles, Video, X } from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'
import Popover from '../Popover'
import { Button } from '@/components/ui/button'
import { MetadataChip } from '@/components/ui/metadata-chip'
import { useSessionBlackboard } from '@/lib/blackboard/use-session-blackboard'
import type { MatchedItem, SessionMatch } from '@/lib/blackboard/match'
import { toWorkItems } from '@/lib/blackboard/work'
import { clearSessionOverride, dismissKeyDate, hideForSession, type WriteResult } from '@/lib/blackboard/work-writes'
import type { WorkspaceLink } from '@/lib/types'
import type { TimetableSession } from '@/lib/timetable/session'
import { ACCENT_BORDER, ACCENT_TEXT, type UiAccent } from '@/lib/theme'
import type { BbKeyDate } from '@/lib/blackboard/types'
import { cn } from '@/lib/utils/cn'
import { normalizeUrl } from '@/lib/utils/url'
import { microLabel } from './SessionPrepPanel'
import WorkRow from './WorkRow'

type BlackboardSession = Pick<TimetableSession, 'uid' | 'moduleCode' | 'start' | 'type'>

/** Everything Blackboard matched to a session, for the calendar popover's one-line count. Hidden items don't count. */
export function matchCount(match: SessionMatch | null): number {
  if (!match) return 0
  return match.slides.length + match.readings.length + match.recordings.length + match.other.length + match.keyDates.length
}

/** Why an item is here, quietly. A date match needs no explaining. */
function hintFor(item: MatchedItem): string | null {
  switch (item.confidence) {
    case 'date':
      return null
    case 'ordinal':
      return item.inferred ? 'best guess' : 'by lecture number'
    case 'week':
      return 'this week'
    case 'attached':
      return 'added by you'
  }
}

const GROUPS = [
  { key: 'slides', label: 'Slides', Icon: Presentation },
  { key: 'readings', label: 'Readings', Icon: BookOpen },
  { key: 'recordings', label: 'Recordings', Icon: Video },
  { key: 'other', label: 'Other', Icon: FileText },
] as const

function ItemLine({
  item,
  Icon,
  accent,
  sessionUid,
  pinned,
  onPin,
}: {
  item: MatchedItem
  Icon: typeof FileText
  accent: UiAccent
  sessionUid: string
  pinned: boolean
  onPin: (href: string) => Promise<boolean>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hint = hintFor(item)
  const attached = item.confidence === 'attached'

  const pin = async () => {
    if (!item.href) return
    setBusy(true)
    setError(null)
    const ok = await onPin(item.href)
    setBusy(false)
    if (!ok) setError('Couldn’t pin it as a reading.')
  }

  const dismiss = async () => {
    setBusy(true)
    setError(null)
    const result: WriteResult = await (attached
      ? clearSessionOverride(sessionUid, item.content.id)
      : hideForSession(sessionUid, item.content.id))
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <li className="group flex flex-col">
      <div className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-container-high/50">
        <Icon className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
        {item.href ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-on-surface hover:underline"
          >
            <span className="truncate">{item.label}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-40" strokeWidth={1.75} aria-hidden />
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{item.label}</span>
        )}
        {hint && <span className="shrink-0 text-[11px] text-on-surface-variant">{hint}</span>}
        {pinned && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-on-surface-variant">
            <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
            Pinned
          </span>
        )}
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {item.href && !pinned && (
            <Button
              variant="ghost"
              size="sm"
              accent={accent}
              disabled={busy}
              onClick={() => void pin()}
              aria-label={`Pin ${item.label} as a reading`}
            >
              <Pin className="h-3 w-3" strokeWidth={1.75} />
              Pin
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            accent={accent}
            disabled={busy}
            onClick={() => void dismiss()}
            aria-label={attached ? `Remove ${item.label} from this session` : `${item.label} is not relevant to this session`}
          >
            {attached ? <X className="h-3 w-3" strokeWidth={1.75} /> : <EyeOff className="h-3 w-3" strokeWidth={1.75} />}
            {attached ? 'Remove' : 'Not relevant'}
          </Button>
        </span>
      </div>
      {error && (
        <p role="alert" className="px-1 text-xs text-error">
          {error}
        </p>
      )}
    </li>
  )
}

/** "N hidden", quietly; opens in place to the items marked Not relevant, each with Restore. */
function HiddenItems({ items, accent, sessionUid }: { items: MatchedItem[]; accent: UiAccent; sessionUid: string }) {
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) return null

  const restore = async (item: MatchedItem) => {
    setBusyId(item.content.id)
    setError(null)
    const result = await clearSessionOverride(sessionUid, item.content.id)
    setBusyId(null)
    if (result.error) setError(result.error)
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="self-start rounded-sm text-[11px] text-on-surface-variant hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
      >
        {items.length} hidden
      </button>
      {open && (
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.content.id} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-container-high/50">
              <span className="min-w-0 flex-1 truncate text-sm text-on-surface-variant">{item.label}</span>
              <Button
                variant="ghost"
                size="sm"
                accent={accent}
                disabled={busyId === item.content.id}
                onClick={() => void restore(item)}
                aria-label={`Restore ${item.label} to this session`}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="px-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  )
}

/** One announcement about this session: not a task, so no done toggle, confirm or re-date. Just its words, and Dismiss. */
function AnnouncementLine({ keyDate, sourceUrl }: { keyDate: BbKeyDate; sourceUrl: string | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const dismiss = async () => {
    setBusy(true)
    setError(null)
    const result = await dismissKeyDate(keyDate.id)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-container-high/50">
        <span className="min-w-0 flex-1 truncate text-sm text-on-surface" title={keyDate.title}>
          {keyDate.title}
        </span>
        <Popover
          label="What the announcement said"
          panelClassName="w-[min(24rem,calc(100vw-2rem))]"
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
            >
              <MetadataChip accent="blue" icon={<Sparkles className="h-3 w-3" strokeWidth={1.75} aria-hidden />}>
                From an announcement
              </MetadataChip>
            </button>
          )}
        >
          <div className="flex flex-col gap-2 text-sm">
            <blockquote className={cn('border-l-2 pl-3 text-on-surface', ACCENT_BORDER.blue)}>
              &ldquo;{keyDate.quote}&rdquo;
            </blockquote>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('inline-flex items-center gap-1 self-start text-xs font-semibold hover:underline', ACCENT_TEXT.blue)}
              >
                Open source
                <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden />
              </a>
            )}
          </div>
        </Popover>
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
          Dismiss
        </Button>
      </div>
      {error && (
        <p role="alert" className="px-1 text-xs text-error">
          {error}
        </p>
      )}
      <ConfirmDialog
        isOpen={confirming}
        message="Dismiss this date? It won't be suggested again."
        confirmLabel="Dismiss"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          void dismiss()
        }}
      />
    </li>
  )
}

function Group({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`${microLabel} flex items-center gap-1.5`}>
        {icon}
        {label}
      </span>
      <ul className="flex flex-col">{children}</ul>
    </div>
  )
}

/**
 * What Blackboard holds for one lecture: slides, readings, recordings, other
 * items and the dates due for it, with the Talis module reading list. Showing
 * a match never touches prep; only Pin (an explicit reading, through the
 * caller's `addReading`) does. Mounted once, on the session page.
 */
export default function SessionBlackboardBlock({
  session,
  accent,
  readings,
  addReading,
}: {
  session: BlackboardSession
  accent: UiAccent
  /** The session's readings from the page's own useSessionPrep. */
  readings: WorkspaceLink[]
  /** useSessionPrep's addReading: files the link as a tracked reading. */
  addReading: (url: string) => Promise<unknown>
}) {
  const { match, course, loading, error } = useSessionBlackboard(session)
  const [now] = useState(() => new Date())

  const pinnedUrls = useMemo(() => new Set(readings.map((r) => normalizeUrl(r.url) ?? r.url)), [readings])

  const dueItems = useMemo(() => {
    if (!match || !course) return []
    const contentUrlById = new Map<string, string | null>()
    for (const group of [match.slides, match.readings, match.recordings, match.other]) {
      for (const item of group) contentUrlById.set(item.content.id, item.href)
    }
    // Announcements only annotate: they get their own group, never a task row.
    const keyDates = match.keyDates.filter((kd) => !kd.announcement_id)
    return toWorkItems({ courses: [course], assignments: [], keyDates, sessions: [], contentUrlById, now })
  }, [match, course, now])

  const announcements = useMemo(() => match?.keyDates.filter((kd) => !!kd.announcement_id) ?? [], [match])

  if (loading) return <p className="text-xs text-on-surface-variant">Loading…</p>
  if (error) {
    return (
      <p role="alert" className="text-xs text-error">
        Couldn’t load Blackboard: {error}
      </p>
    )
  }

  const readingList = match?.moduleReadingList ?? null
  const readingListLink = readingList && (
    <a
      href={readingList.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 self-start text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:underline"
    >
      Module reading list (Talis)
      <ExternalLink className="h-3 w-3 opacity-60" strokeWidth={1.75} aria-hidden />
    </a>
  )

  if (!match || matchCount(match) === 0) {
    return (
      <>
        <p className="text-xs text-on-surface-variant">Nothing on Blackboard matched this session.</p>
        {match && <HiddenItems items={match.hidden} accent={accent} sessionUid={session.uid} />}
        {readingListLink}
      </>
    )
  }

  const pin = async (href: string) => !!(await addReading(href))

  return (
    <>
      {GROUPS.map(({ key, label, Icon }) =>
        match[key].length > 0 ? (
          <Group key={key} label={label}>
            {match[key].map((item) => (
              <ItemLine
                key={`${key}:${item.content.id}`}
                item={item}
                Icon={Icon}
                accent={accent}
                sessionUid={session.uid}
                pinned={!!item.href && pinnedUrls.has(normalizeUrl(item.href) ?? item.href)}
                onPin={pin}
              />
            ))}
          </Group>
        ) : null
      )}
      {dueItems.length > 0 && (
        <Group label="Due for this session" icon={<CalendarClock className="h-3 w-3" strokeWidth={1.75} aria-hidden />}>
          {dueItems.map((item) => (
            <WorkRow key={item.key} item={item} now={now} accent={accent} showModule={false} compact />
          ))}
        </Group>
      )}
      {announcements.length > 0 && (
        <Group label="Announcements about this session" icon={<Megaphone className="h-3 w-3" strokeWidth={1.75} aria-hidden />}>
          {announcements.map((kd) => (
            <AnnouncementLine key={kd.id} keyDate={kd} sourceUrl={null} />
          ))}
        </Group>
      )}
      <HiddenItems items={match.hidden} accent={accent} sessionUid={session.uid} />
      {readingListLink}
    </>
  )
}
