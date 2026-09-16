'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

// A per-browser remembered set of ids (e.g. which folders are collapsed).
// Convenience state only — localStorage can be unavailable (private mode,
// blocked site data), so every access is guarded and an in-memory copy
// keeps the UI working for the session either way. Read through
// useSyncExternalStore so the server render (and first client render)
// both see "nothing stored" without a setState-in-effect.

const CHANGE_EVENT = 'stored-id-set-change'
const memory = new Map<string, string>()

function read(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key)
    if (value !== null) return value
  } catch {
    // fall through to memory
  }
  return memory.get(key) ?? null
}

function write(key: string, value: string) {
  memory.set(key, value)
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // memory copy is enough for this session
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function parse(raw: string | null): Set<string> {
  if (!raw) return new Set()
  try {
    const value: unknown = JSON.parse(raw)
    return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

export function useStoredIdSet(key: string): [Set<string>, (next: Set<string>) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  )
  const ids = useMemo(() => parse(raw), [raw])
  const update = useCallback((next: Set<string>) => write(key, JSON.stringify([...next])), [key])
  return [ids, update]
}
