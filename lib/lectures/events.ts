'use client'

import { useSyncExternalStore } from 'react'

// "Lecture prep changed somewhere on this page" — a reading ticked in the
// calendar popover, notes marked on /lectures — so every view showing
// traffic lights can refetch. Same pattern as lib/habits/events.ts.

const EVENT = 'lectures:changed'
let version = 0

export function notifyLecturesChanged() {
  version++
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

export function useLecturesVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  )
}
