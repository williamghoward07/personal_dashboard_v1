import { createClient } from './supabase/client'

// Cookie-aware browser client, shared as a singleton across the ~20 client
// components that import { supabase } from here. Only safe to import from
// 'use client' files — server components need lib/supabase/server.ts.
export const supabase = createClient()
