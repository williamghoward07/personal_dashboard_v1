'use client'

import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import Popover from '../Popover'
import { CountBadge } from '@/components/ui/count-badge'
import { useAnnouncements } from '@/lib/blackboard/use-announcements'
import AnnouncementEntry from './AnnouncementEntry'

/**
 * A module's announcements as a small count chip in the corner of its
 * section. Opens in place; there is no chip when the module has none. The
 * announcements are an extra notification: they never appear in the main flow.
 */
export default function AnnouncementsChip({
  moduleCode,
  align = 'end',
}: {
  moduleCode: string
  /** Which edge of the chip the panel hangs from: 'end' for a chip in a right-hand corner, 'start' for one near the left. */
  align?: 'start' | 'end'
}) {
  const { announcements, unread, markRead } = useAnnouncements(moduleCode)
  const [now] = useState(() => new Date())

  if (announcements.length === 0) return null

  return (
    <Popover
      align={align}
      label={`Announcements for ${moduleCode}`}
      panelClassName="w-[min(26rem,calc(100vw-2rem))]"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`${announcements.length} announcements${unread > 0 ? `, ${unread} unread` : ''}`}
          className="flex items-center gap-1 rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-outline"
        >
          <Megaphone className="h-3.5 w-3.5 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
          <CountBadge count={announcements.length} accent={unread > 0 ? 'blue' : 'neutral'} />
        </button>
      )}
    >
      <ul className="flex max-h-96 flex-col gap-0.5 overflow-y-auto">
        {announcements.map((a) => (
          <AnnouncementEntry key={a.id} announcement={a} now={now} showSource={false} onOpen={(id) => void markRead(id)} />
        ))}
      </ul>
    </Popover>
  )
}
