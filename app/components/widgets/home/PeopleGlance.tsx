'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Contact } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { FollowUp } from '@/lib/types'
import type { HomeWidgetProps } from '@/lib/home/layout'
import WidgetCard from '../../WidgetCard'
import { ACCENT_TEXT } from '@/lib/theme'

// A wider card can afford more follow-ups. Fetched once at the ceiling and
// sliced in render, so dragging the card wider never refetches.
const MAX_ROWS = 8
function rowsForSpan(span: number) {
  if (span >= 3) return MAX_ROWS
  if (span === 2) return 5
  return 3
}

/**
 * Unlike the other home glance cards, this one can't just wrap the whole
 * card in a single Link (see HomeSectionCard) — each follow-up needs its
 * own link straight to that person's detail view, so the card is built
 * directly on WidgetCard with the "view all" arrow moved into the action
 * slot instead.
 */
export default function PeopleGlance({ span = 1 }: HomeWidgetProps) {
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

  const shown = followUps.slice(0, rowsForSpan(span))

  return (
    <WidgetCard
      title="People"
      icon={<Contact className="h-4 w-4" />}
      accent="amber"
      className="h-full"
      action={
        <Link
          href="/people"
          aria-label="View all people"
          className={`transition-transform duration-300 hover:translate-x-0.5 hover:-translate-y-0.5 ${ACCENT_TEXT.amber}`}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      {loading ? (
        <p>Loading...</p>
      ) : shown.length === 0 ? (
        <p>Nothing to follow up.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map((f) => (
            <li key={f.id}>
              <Link
                href={`/people?person=${f.person_id}`}
                className="block truncate text-on-surface hover:text-people-amber"
              >
                {f.note}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
