'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RugbySession } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import RugbySessionFormModal from './RugbySessionFormModal'

export default function RugbySessionsCard() {
  const [sessions, setSessions] = useState<RugbySession[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<RugbySession | null>(null)
  const [deletingSession, setDeletingSession] = useState<RugbySession | null>(null)

  const refresh = () => {
    supabase
      .from('rugby_sessions')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => {
        setSessions(data ?? [])
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  return (
    <>
      <WidgetCard
        title="Rugby sessions"
        accent="mint"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add rugby session"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary-container"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {loading ? (
          <p>Loading...</p>
        ) : sessions.length === 0 ? (
          <p>No sessions logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-outline-variant p-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-on-surface">
                    {s.date}
                    {s.duration_minutes ? ` · ${s.duration_minutes}m` : ''}
                  </span>
                  {s.notes && (
                    <span className="truncate text-xs text-on-surface-variant">{s.notes}</span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingSession(s)}
                    aria-label={`Edit session on ${s.date}`}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingSession(s)}
                    aria-label={`Delete session on ${s.date}`}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      <RugbySessionFormModal
        isOpen={isAddOpen}
        heading="New rugby session"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          await supabase.from('rugby_sessions').insert(values)
          setIsAddOpen(false)
          refresh()
        }}
      />

      <RugbySessionFormModal
        isOpen={editingSession !== null}
        heading="Edit rugby session"
        initialValues={editingSession}
        onClose={() => setEditingSession(null)}
        onSave={async (values) => {
          if (!editingSession) return
          await supabase.from('rugby_sessions').update(values).eq('id', editingSession.id)
          setEditingSession(null)
          refresh()
        }}
      />

      <ConfirmDialog
        isOpen={deletingSession !== null}
        message={`Delete the session on ${deletingSession?.date}? This can't be undone.`}
        onCancel={() => setDeletingSession(null)}
        onConfirm={async () => {
          if (!deletingSession) return
          await supabase.from('rugby_sessions').delete().eq('id', deletingSession.id)
          setDeletingSession(null)
          refresh()
        }}
      />
    </>
  )
}
