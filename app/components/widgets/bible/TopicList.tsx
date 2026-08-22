'use client'

import { useEffect, useState } from 'react'
import { listTopics } from '@/lib/bible/topics'
import type { BibleTopic } from '@/lib/bible/types'

// Tap 1 of the topical index: the fixed 7-pill list of struggles. Tapping
// a pill again deselects it (handled by the parent's onSelect toggle).
export default function TopicList({
  selectedTopicId,
  onSelect,
}: {
  selectedTopicId: string | null
  onSelect: (topic: BibleTopic) => void
}) {
  const [topics, setTopics] = useState<BibleTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listTopics()
      .then(setTopics)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-on-surface-variant">Loading…</p>
  if (topics.length === 0) return <p className="text-sm text-on-surface-variant">No topics yet.</p>

  return (
    <div className="flex flex-wrap gap-1.5">
      {topics.map((topic) => {
        const active = topic.id === selectedTopicId
        return (
          <button
            key={topic.id}
            type="button"
            onClick={() => onSelect(topic)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? 'border-bible-crimson/50 bg-bible-crimson/10 text-bible-crimson'
                : 'border-outline-variant text-on-surface-variant hover:border-outline'
            }`}
          >
            {topic.label}
          </button>
        )
      })}
    </div>
  )
}
