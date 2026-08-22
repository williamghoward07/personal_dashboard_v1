'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { BibleSessionQuestion } from '@/lib/bible/types'

// One question: text, answer textarea, save button, and an answered
// indicator dot (not a checkbox — a question isn't binary-completable by
// clicking it, it's completable by saving an answer).
export default function SessionQuestionRow({
  question,
  onSave,
}: {
  question: BibleSessionQuestion
  onSave: (answerText: string) => void | Promise<void>
}) {
  const [answer, setAnswer] = useState(question.answer_text ?? '')
  const [saving, setSaving] = useState(false)
  const answered = question.answered_at !== null

  const handleSave = async () => {
    const trimmed = answer.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onSave(trimmed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${answered ? 'bg-bible-crimson' : 'bg-outline-variant'}`}
        />
        <p className="flex-1 text-sm font-medium text-on-surface">{question.question_text}</p>
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Your answer…"
        rows={3}
        className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-bible-crimson"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !answer.trim()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" />
          Save
        </button>
      </div>
    </li>
  )
}
