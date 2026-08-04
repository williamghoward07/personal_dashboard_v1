'use client'

import { useState } from 'react'
import { Hexagon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-outline-variant bg-surface-container-high p-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <Hexagon className="h-8 w-8 text-secondary-container" strokeWidth={1.5} />
          <div>
            <h1 className="font-display text-headline-md font-bold tracking-wide text-on-surface">
              STUDY COPILOT
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">Sign in to continue</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.62l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
            />
          </svg>
          {loading ? 'Redirecting…' : 'Sign in with Google'}
        </button>
      </div>
    </main>
  )
}
