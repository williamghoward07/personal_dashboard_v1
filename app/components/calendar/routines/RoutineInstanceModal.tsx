'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RoutineInstance, RoutineItem } from '@/lib/types'
import Modal from '../../Modal'
import ConfirmDialog from '../../ConfirmDialog'
import RoutineItemEditor from './RoutineItemEditor'

function formatWhen(startAt: string) {
  const date = new Date(startAt)
  const day = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
  return `${day} at ${time}`
}

// Opened by clicking a scheduled routine block anywhere on the Calendar
// page (the Routines tab's own DayTimeline, or the normal Day view / month-
// week day-detail popup via onSelectRoutineInstance). Editing steps here
// edits the shared routine template, not just this occurrence — there is no
// per-instance override in v1, matching the decided behavior.
export default function RoutineInstanceModal({
  instance,
  onClose,
  onChanged,
}: {
  instance: RoutineInstance
  onClose: () => void
  onChanged: () => void
}) {
  const [items, setItems] = useState<RoutineItem[]>([])
  const [loading, setLoading] = useState(instance.routine_id !== null)
  const [error, setError] = useState<string | null>(null)
  const [deletingInstance, setDeletingInstance] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!instance.routine_id) return
    setLoading(true)
    supabase
      .from('routine_items')
      .select('*')
      .eq('routine_id', instance.routine_id)
      .order('sort_order', { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(`Couldn't load steps: ${fetchError.message}`)
        setItems((data ?? []) as RoutineItem[])
        setLoading(false)
      })
  }, [instance.routine_id])

  const deleteOccurrence = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/routines/instances/${instance.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}) as { message?: string })
        setError(json.message ?? "Couldn't delete this occurrence.")
        return
      }
      onChanged()
      onClose()
    } finally {
      setBusy(false)
      setDeletingInstance(false)
    }
  }

  const deleteTemplate = async () => {
    if (!instance.routine_id) return
    setBusy(true)
    try {
      const { error: deleteError } = await supabase.from('routines').delete().eq('id', instance.routine_id)
      if (deleteError) {
        setError(`Couldn't delete routine: ${deleteError.message}`)
        return
      }
      onChanged()
      onClose()
    } finally {
      setBusy(false)
      setDeletingTemplate(false)
    }
  }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: instance.routine_colour }} />
            <div>
              <h2 className="font-display text-base font-bold text-on-surface">{instance.routine_name}</h2>
              <p className="text-xs text-on-surface-variant">
                {formatWhen(instance.start_at)} · {instance.duration_minutes}m
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-error/30 bg-error/10 px-2 py-1.5 text-xs text-error">{error}</div>
        )}

        {!instance.routine_id ? (
          <p className="text-sm text-on-surface-variant">
            The routine template this was scheduled from has since been deleted — this occurrence still shows on
            your calendar, but its step breakdown is no longer available to edit.
          </p>
        ) : loading ? (
          <p className="text-sm text-on-surface-variant">Loading steps...</p>
        ) : (
          <RoutineItemEditor
            routineId={instance.routine_id}
            items={items}
            onItemsChange={setItems}
            ensureRoutineId={async () => instance.routine_id as string}
          />
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t border-outline-variant/60 pt-3">
          <button
            type="button"
            onClick={() => setDeletingInstance(true)}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-error"
          >
            Delete this scheduled occurrence
          </button>
          {instance.routine_id && (
            <button
              type="button"
              onClick={() => setDeletingTemplate(true)}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10"
            >
              Delete routine template
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deletingInstance}
        message="Delete this scheduled occurrence? The event is also removed from Google Calendar. The routine template itself is kept."
        onCancel={() => setDeletingInstance(false)}
        onConfirm={deleteOccurrence}
      />

      <ConfirmDialog
        isOpen={deletingTemplate}
        message={`Delete the "${instance.routine_name}" routine template? Its steps are removed too. Already-scheduled occurrences (including this one) are kept on your calendar.`}
        onCancel={() => setDeletingTemplate(false)}
        onConfirm={deleteTemplate}
      />
    </Modal>
  )
}
