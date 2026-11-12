'use client'

import { useSyncExternalStore } from 'react'

// "Blackboard work changed somewhere on this page" — an AI-found date
// confirmed, an assignment marked done, a processing pass finishing — so the
// work list, the lecture block, the calendar and the home widget can refetch.
// Same pattern as lib/lectures/events.ts.

const EVENT = 'bb-work:changed'
let version = 0

export function notifyWorkChanged() {
  version++
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

export function useWorkVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  )
}
