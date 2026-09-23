'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { TimeLog } from '@/lib/types'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const inputClass =
  'rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs text-on-surface outline-none focus:border-academic-orange'

export default function TaskTimeTracking({ taskId }: { taskId: string }) {
  const [logs, setLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [minutes, setMinutes] = useState('')

  const refresh = () => {
    supabase
      .from('time_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setLogs(data ?? [])
        setLoading(false)
      })
  }

  useEffect(refresh, [taskId])

  const total = logs.reduce((sum, l) => sum + l.minutes_spent, 0)
  const recent = logs.slice(-10)
  const maxMinutes = Math.max(...recent.map((l) => l.minutes_spent), 1)

  const addLog = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(minutes)
    if (!value || value <= 0) return
    await supabase.from('time_logs').insert({ task_id: taskId, date, minutes_spent: value })
    setMinutes('')
    setIsAdding(false)
    refresh()
  }

  const deleteLog = async (id: string) => {
    await supabase.from('time_logs').delete().eq('id', id)
    refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-on-surface-variant">Time spent</h3>
        <button
          type="button"
          onClick={() => setIsAdding((v) => !v)}
          aria-label="Log time"
          className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high hover:text-academic-orange"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-end gap-3">
        <span className="font-display text-lg font-semibold text-on-surface">
          {loading ? '...' : formatMinutes(total)}
        </span>
        {!loading && recent.length > 0 && (
          <div className="flex h-6 flex-1 items-end gap-0.5">
            {recent.map((l) => (
              <div
                key={l.id}
                title={`${l.date}: ${formatMinutes(l.minutes_spent)}`}
                className="flex-1 rounded-t-sm bg-academic-orange/60"
                style={{ height: `${Math.max((l.minutes_spent / maxMinutes) * 100, 8)}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {isAdding && (
        <form onSubmit={addLog} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Minutes
            <input
              type="number"
              min={1}
              autoFocus
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={`w-20 ${inputClass}`}
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-academic-orange px-2 py-1 text-xs font-medium text-surface-container-lowest hover:brightness-110"
          >
            Log
          </button>
        </form>
      )}

      {!loading && logs.length > 0 && (
        <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
          {[...logs].reverse().map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 text-xs text-on-surface-variant"
            >
              <span>
                {l.date} · {formatMinutes(l.minutes_spent)}
              </span>
              <button
                type="button"
                onClick={() => deleteLog(l.id)}
                aria-label="Delete time log"
                className="rounded p-0.5 text-on-surface-variant hover:text-error"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
