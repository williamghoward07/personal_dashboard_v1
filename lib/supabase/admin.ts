// SERVICE ROLE CLIENT — bypasses Row Level Security entirely.
// This must NEVER be imported into client components (or anything bundled
// for the browser). Server-only: route handlers, server actions, and
// background/sync jobs. Importing this from a 'use client' file leaks the
// service_role key into the browser bundle.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
