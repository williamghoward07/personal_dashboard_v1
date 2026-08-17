'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ActivitySession } from '@/lib/types'
import WidgetCard from '../../WidgetCard'
import ConfirmDialog from '../../ConfirmDialog'
import ActivitySessionFormModal from './ActivitySessionFormModal'

export default function ActivitySessionsCard() {
  const [sessions, setSessions] = useState<ActivitySession[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<ActivitySession | null>(null)
  const [deletingSession, setDeletingSession] = useState<ActivitySession | null>(null)

  const refresh = () => {
    supabase
      .from('activity_sessions')
      .select('*')
      .order('occurred_at', { ascending: false })
      .then(({ data }) => {
        setSessions((data ?? []) as ActivitySession[])
        setLoading(false)
      })
  }

  useEffect(refresh, [])

  return (
    <>
      <WidgetCard
        title="Activity sessions"
        accent="mint"
        className="sm:col-span-2 xl:col-span-4"
        action={
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            aria-label="Add activity session"
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
                    {s.activity_type} · {s.occurred_at.slice(0, 10)}
                    {s.duration_minutes ? ` · ${s.duration_minutes}m` : ''}
                    {s.distance_km ? ` · ${s.distance_km}km` : ''}
                  </span>
                  {s.notes && (
                    <span className="truncate text-xs text-on-surface-variant">{s.notes}</span>
                  )}
                  {s.source === 'strava_export' && (
                    <span className="text-[10px] uppercase tracking-wide text-on-surface-variant/70">
                      Imported from Strava
                    </span>
                  )}
                </div>
                {s.source === 'manual' && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingSession(s)}
                      aria-label={`Edit session on ${s.occurred_at.slice(0, 10)}`}
                      className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSession(s)}
                      aria-label={`Delete session on ${s.occurred_at.slice(0, 10)}`}
                      className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      <ActivitySessionFormModal
        isOpen={isAddOpen}
        heading="New activity session"
        onClose={() => setIsAddOpen(false)}
        onSave={async (values) => {
          await supabase.from('activity_sessions').insert({ ...values, source: 'manual' })
          setIsAddOpen(false)
          refresh()
        }}
      />

      <ActivitySessionFormModal
        isOpen={editingSession !== null}
        heading="Edit activity session"
        initialValues={editingSession}
        onClose={() => setEditingSession(null)}
        onSave={async (values) => {
          if (!editingSession) return
          await supabase.from('activity_sessions').update(values).eq('id', editingSession.id)
          setEditingSession(null)
          refresh()
        }}
      />

      <ConfirmDialog
        isOpen={deletingSession !== null}
        message={`Delete the ${deletingSession?.activity_type} session on ${deletingSession?.occurred_at.slice(0, 10)}? This can't be undone.`}
        onCancel={() => setDeletingSession(null)}
        onConfirm={async () => {
          if (!deletingSession) return
          await supabase.from('activity_sessions').delete().eq('id', deletingSession.id)
          setDeletingSession(null)
          refresh()
        }}
      />
    </>
  )
}
