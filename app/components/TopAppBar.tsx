'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useScrollDirection } from '@/lib/use-scroll-direction'

export default function TopAppBar() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollDirection = useScrollDirection()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user
      setEmail(sessionUser?.email ?? null)

      const fullName = sessionUser?.user_metadata?.full_name ?? sessionUser?.user_metadata?.name
      setUsername(fullName?.split(' ')[0] ?? sessionUser?.email?.split('@')[0] ?? null)
    })
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    setError(null)

    const supabase = createClient()
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
      setSigningOut(false)
      return
    }

    router.refresh()
    router.push('/login')
  }

  return (
    <header
      className={`fixed top-0 z-30 flex h-16 w-full items-center justify-between border-b border-outline-variant bg-surface/80 px-8 backdrop-blur-xl transition-transform duration-200 md:sticky md:translate-y-0 ${
        scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <span className="font-display text-headline-md font-bold tracking-wide text-secondary-container">
        STUDY COPILOT
      </span>
      <div className="flex items-center gap-4">
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          {username ? `${username}'s Dashboard` : 'Personal Dashboard'}
        </span>
        {error && <span className="text-xs text-error">{error}</span>}
        {email && (
          <span className="text-xs text-on-surface-variant">{email}</span>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors duration-200 hover:bg-surface-container hover:text-on-surface disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  )
}
