'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { answerQuestion, completeSession, getSession, listSessionQuestions } from '@/lib/bible/studies'
import { getPassageById } from '@/lib/bible/passages-repo'
import { formatReference } from '@/lib/bible/passages'
import type { BiblePassage, BibleSessionQuestion, BibleStudySession } from '@/lib/bible/types'
import SessionQuestionRow from './SessionQuestionRow'
import PassagePanel from './PassagePanel'

// Session detail page: header + one question row per pre-written question
// + a manual complete button + the shared PassagePanel rendered inline
// (unwrapped — no need for another modal layer on a page that's already
// dedicated) for the session's fixed passage.
export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<BibleStudySession | null>(null)
  const [passage, setPassage] = useState<BiblePassage | null>(null)
  const [questions, setQuestions] = useState<BibleSessionQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)

  const refresh = () => {
    setLoading(true)
    getSession(sessionId)
      .then(async (sessionRow) => {
        setSession(sessionRow)
        if (sessionRow) {
          const [passageRow, questionRows] = await Promise.all([
            getPassageById(sessionRow.passage_id),
            listSessionQuestions(sessionRow.id),
          ])
          setPassage(passageRow)
          setQuestions(questionRows)
        }
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this session."))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [sessionId])

  const handleAnswer = async (questionId: string, answerText: string) => {
    await answerQuestion(questionId, answerText)
    refresh()
  }

  const handleComplete = async () => {
    if (!session) return
    setCompleting(true)
    try {
      await completeSession(session.id)
      refresh()
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
        <Link href="/bible" className="w-fit text-sm text-on-surface-variant hover:text-on-surface hover:underline">
          ← Back to Bible
        </Link>
        <p className="text-sm text-on-surface-variant">Session not found.</p>
      </main>
    )
  }

  const answeredCount = questions.filter((q) => q.answered_at !== null).length

  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/bible"
          className="flex w-fit items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Bible
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 font-display text-headline-lg font-bold text-on-surface">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
            Session {session.session_number}
            {session.title ? `: ${session.title}` : ''}
          </h1>
          {session.completed_at ? (
            <StatusBadge accent="crimson" dot="static">
              Completed
            </StatusBadge>
          ) : (
            <Button type="button" size="sm" accent="crimson" onClick={handleComplete} disabled={completing}>
              Mark session complete
            </Button>
          )}
        </div>
        {passage && (
          <span className="text-xs text-on-surface-variant">
            {formatReference(passage)} · {answeredCount}/{questions.length} answered
          </span>
        )}
      </div>

      {error && <p className="text-xs text-error">{error}</p>}

      {questions.length > 0 && (
        <ul className="flex flex-col gap-3">
          {questions.map((question) => (
            <SessionQuestionRow key={question.id} question={question} onSave={(text) => handleAnswer(question.id, text)} />
          ))}
        </ul>
      )}

      {passage && <PassagePanel passage={passage} sessionId={session.id} />}
    </main>
  )
}
