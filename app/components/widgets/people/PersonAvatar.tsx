'use client'

import { useState } from 'react'
import { initials } from './shared'

/**
 * Google's photo URLs rotate and expire, so a broken image falls back to
 * initials rather than showing a torn-image glyph.
 */
export default function PersonAvatar({
  fullName,
  photoUrl,
  size = 'sm',
}: {
  fullName: string
  photoUrl?: string | null
  size?: 'sm' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const box = size === 'lg' ? 'h-14 w-14 text-sm' : 'h-8 w-8 text-[10px]'

  if (photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google photo host isn't in next.config remotePatterns
      <img
        src={photoUrl}
        alt=""
        onError={() => setFailed(true)}
        className={`${box} shrink-0 rounded-full border border-outline-variant object-cover`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-full border border-people-amber/30 bg-people-amber/10 font-display font-semibold text-people-amber`}
    >
      {initials(fullName)}
    </span>
  )
}
