'use client'

import { useSyncExternalStore } from 'react'

// "Habit completions changed somewhere on this page" — e.g. the morning
// routine card ticked its last core step — so other widgets showing habit
// progress (Daily Goals ring, Habits card) can refetch. A version number
// read through useSyncExternalStore: put it in an effect's deps to reload.

const EVENT = 'habits:changed'
let version = 0

export function notifyHabitsChanged() {
  version++
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

export function useHabitsVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  )
}
