'use client'

import { useEffect, useState } from 'react'

const formatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London',
})

export default function HomeDate() {
  const [date, setDate] = useState('')

  useEffect(() => {
    const refresh = () => setDate(formatter.format(new Date()))
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return <p className="mt-1 min-h-5 text-sm text-on-surface-variant">{date}</p>
}
