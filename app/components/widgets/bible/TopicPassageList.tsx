'use client'

import { useEffect, useState } from 'react'
import { listTopicPassagesWithPassage, type BibleTopicPassageWithPassage } from '@/lib/bible/topics'
import { formatReference } from '@/lib/bible/passages'
import type { BiblePassage, BibleTopic } from '@/lib/bible/types'

// Tap 2 of the topical index: the 5-8 curated passages + one-line reasons
// for the tapped topic. Tapping a row opens PassagePanelModal, pre-filled
// with the topic's label as the prompt's starting note — "two taps, zero
// typing" satisfied literally.
export default function TopicPassageList({
  topic,
  onOpenPassage,
}: {
  topic: BibleTopic
  onOpenPassage: (passage: BiblePassage, defaultNote: string) => void
}) {
  const [items, setItems] = useState<BibleTopicPassageWithPassage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listTopicPassagesWithPassage(topic.id)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [topic.id])

  if (loading) return <p className="text-sm text-on-surface-variant">Loading…</p>
  if (items.length === 0) return <p className="text-sm text-on-surface-variant">No passages curated for this topic yet.</p>

  return (
    <ul className="flex flex-col divide-y divide-outline-variant/40 rounded-lg border border-outline-variant">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpenPassage(item.passage, topic.label)}
            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface-container-high"
          >
            <span className="text-sm font-medium text-on-surface">{formatReference(item.passage)}</span>
            <span className="text-xs text-on-surface-variant">{item.reason}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
