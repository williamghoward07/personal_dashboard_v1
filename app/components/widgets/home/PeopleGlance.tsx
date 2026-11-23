'use client'

import LoadingSkeleton from '@/app/components/LoadingSkeleton'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Contact } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FollowUp } from '@/lib/types'
import { widgetDensity, type HomeWidgetDimensions } from '@/lib/home/widget-content'
import { formatDueDay } from '../../lectures/work-format'
import WidgetCard from '../../WidgetCard'
import { ACCENT_TEXT } from '@/lib/theme'

const MAX_ROWS = 10

/**
 * Unlike the other home glance cards, this one can't just wrap the whole
 * card in a single Link (see HomeSectionCard) — each follow-up needs its
 * own link straight to that person's detail view, so the card is built
 * directly on WidgetCard with the "view all" arrow moved into the action
 * slot instead.
 */
export default function PeopleGlance(dimensions: HomeWidgetDimensions) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('follow_ups')
      .select('*')
      .is('completed_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(MAX_ROWS)
      .then(({ data }) => {
        setFollowUps(data ?? [])
        setLoading(false)
      })
  }, [])

  const density = widgetDensity(dimensions)
  const shown = followUps.slice(0, [3, 6, MAX_ROWS][density])

  return (
    <WidgetCard
      title="People"
      icon={<Contact className="h-4 w-4" />}
      accent="amber"
      className="h-full min-w-0"
      action={
        <Link
          href="/people"
          aria-label="View all people"
          className={`grid min-h-11 min-w-11 place-items-center rounded [@media(pointer:fine)]:min-h-6 [@media(pointer:fine)]:min-w-6 transition-transform duration-300 hover:translate-x-0.5 hover:-translate-y-0.5 ${ACCENT_TEXT.amber}`}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      {loading ? (
        <LoadingSkeleton label="Loading..." />
      ) : shown.length === 0 ? (
        <p>Nothing to follow up.</p>
      ) : (
        <ul className="grid gap-x-5 gap-y-1 @min-[680px]/home-widget:grid-cols-2">
          {shown.map((f) => (
            <li key={f.id} className="min-w-0">
              <Link
                href={`/people?person=${f.person_id}`}
                className="flex min-h-11 flex-col justify-center rounded py-1 wrap-anywhere text-on-surface hover:text-people-amber"
              >
                <span>{f.note}</span>
                {f.due_date && <span className="text-xs text-on-surface-variant">Due {formatDueDay(f.due_date)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
