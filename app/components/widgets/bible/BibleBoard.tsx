'use client'

import { useEffect, useState } from 'react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { GlassCardHeader, GlassCardContent } from '@/components/ui/glass-card'
import { getActiveStudy, listSessions } from '@/lib/bible/studies'
import type { BiblePassage, BibleStudy, BibleStudySession, BibleTopic } from '@/lib/bible/types'
import StudyImportForm from './StudyImportForm'
import StudySessionList from './StudySessionList'
import TopicList from './TopicList'
import TopicPassageList from './TopicPassageList'
import PassageLookupForm from './PassageLookupForm'
import PassagePanelModal from './PassagePanelModal'

// Module home: three independent, always-visible sections (not a tab
// toggle — unlike Education's Modules/Tasks, these are three separate
// features, not two views of one dataset). Only one study is ever active
// (DB-enforced), so this shows it directly with no studies list route.
export default function BibleBoard() {
  const [study, setStudy] = useState<BibleStudy | null>(null)
  const [sessions, setSessions] = useState<BibleStudySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<BibleTopic | null>(null)
  const [viewing, setViewing] = useState<{ passage: BiblePassage; defaultNote?: string } | null>(null)

  const refresh = () => {
    setLoading(true)
    getActiveStudy()
      .then(async (activeStudy) => {
        setStudy(activeStudy)
        setSessions(activeStudy ? await listSessions(activeStudy.id) : [])
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your Bible study."))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  return (
    <>
      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error sm:col-span-2 xl:col-span-4">
          {error}
        </div>
      )}

      <ModuleGlassCard accent="crimson" className="sm:col-span-2 xl:col-span-4">
        <GlassCardHeader>
          <h2 className="font-display text-sm font-semibold text-foreground">Active Study</h2>
        </GlassCardHeader>
        <GlassCardContent>
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading…</p>
          ) : !study ? (
            <StudyImportForm onImported={refresh} />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-on-surface">{study.title}</h3>
                <span className="text-xs text-on-surface-variant">
                  {sessions.filter((s) => s.completed_at).length}/{sessions.length} sessions complete
                </span>
              </div>
              <StudySessionList sessions={sessions} />
            </div>
          )}
        </GlassCardContent>
      </ModuleGlassCard>

      <ModuleGlassCard accent="crimson" className="sm:col-span-2 xl:col-span-4">
        <GlassCardHeader>
          <h2 className="font-display text-sm font-semibold text-foreground">Topical Index</h2>
        </GlassCardHeader>
        <GlassCardContent className="flex flex-col gap-3">
          <TopicList
            selectedTopicId={selectedTopic?.id ?? null}
            onSelect={(topic) => setSelectedTopic((current) => (current?.id === topic.id ? null : topic))}
          />
          {selectedTopic && (
            <TopicPassageList
              topic={selectedTopic}
              onOpenPassage={(passage, defaultNote) => setViewing({ passage, defaultNote })}
            />
          )}
        </GlassCardContent>
      </ModuleGlassCard>

      <ModuleGlassCard accent="crimson" className="sm:col-span-2 xl:col-span-4">
        <GlassCardHeader>
          <h2 className="font-display text-sm font-semibold text-foreground">Passage Lookup</h2>
        </GlassCardHeader>
        <GlassCardContent>
          <PassageLookupForm onOpenPassage={(passage) => setViewing({ passage })} />
        </GlassCardContent>
      </ModuleGlassCard>

      <PassagePanelModal
        passage={viewing?.passage ?? null}
        defaultNote={viewing?.defaultNote}
        onClose={() => setViewing(null)}
      />
    </>
  )
}
