'use client'

import { useState } from 'react'
import { ACCENT_CHIP } from '@/lib/theme'
import { domainOf, faviconPublicUrl, hashAccent, initialLetter } from './shared'

const SIZE_CLASS = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm' } as const

export default function FaviconTile({
  title,
  url,
  faviconPath,
  size = 'md',
}: {
  title: string
  url: string
  faviconPath: string | null
  size?: 'sm' | 'md'
}) {
  const [failed, setFailed] = useState(false)
  const box = SIZE_CLASS[size]

  if (faviconPath && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Storage public host isn't in next.config remotePatterns (see PersonAvatar.tsx)
      <img
        src={faviconPublicUrl(faviconPath)}
        alt=""
        onError={() => setFailed(true)}
        className={`${box} shrink-0 rounded-lg border border-outline-variant bg-surface-container-lowest object-contain p-1`}
      />
    )
  }

  const accent = hashAccent(domainOf(url) || title)
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-lg border font-display font-semibold ${ACCENT_CHIP[accent]}`}
    >
      {initialLetter(title)}
    </span>
  )
}
