'use client'

import { useState } from 'react'
import { ACCENT_CHIP } from '@/lib/theme'
import { domainOf, faviconPublicUrl, hashAccent, initialLetter } from './shared'

const SIZE_CLASS = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm' } as const

export default function FaviconTile({
  title,
  url,
  faviconPath,
  faviconCustomUrl,
  size = 'md',
}: {
  title: string
  url: string
  faviconPath: string | null
  faviconCustomUrl?: string | null
  size?: 'sm' | 'md'
}) {
  const [customFailed, setCustomFailed] = useState(false)
  const [cachedFailed, setCachedFailed] = useState(false)
  const box = SIZE_CLASS[size]

  // A custom override wins; if it 404s or the host blocks hotlinking, fall
  // back to the auto-detected favicon, then to the initial-letter tile.
  const useCustom = Boolean(faviconCustomUrl) && !customFailed
  const src = useCustom ? faviconCustomUrl! : faviconPath && !cachedFailed ? faviconPublicUrl(faviconPath) : null

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Storage public host isn't in next.config remotePatterns (see PersonAvatar.tsx)
      <img
        src={src}
        alt=""
        onError={() => (useCustom ? setCustomFailed(true) : setCachedFailed(true))}
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
