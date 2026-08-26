'use client'

import { useEffect, useState } from 'react'
import { minutesSinceLondonMidnight, minutesToPx } from './grid-math'

// Refreshed every minute rather than continuously — a calendar time
// indicator doesn't need sub-minute precision, and a coarser interval
// avoids waking every open grid every frame.
export function useCurrentTimeMinutes(): number {
  const [minutes, setMinutes] = useState(() => minutesSinceLondonMidnight(new Date().toISOString()))

  useEffect(() => {
    const id = setInterval(() => setMinutes(minutesSinceLondonMidnight(new Date().toISOString())), 60_000)
    return () => clearInterval(id)
  }, [])

  return minutes
}

export default function CurrentTimeLine({ nowMinutes }: { nowMinutes: number }) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top: minutesToPx(nowMinutes) }}
    >
      <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-error" />
      <span className="h-px flex-1 bg-error" />
    </div>
  )
}
