import { NextResponse } from 'next/server'
import { generateStructuredWithUsage } from '@/lib/ai/gemini'
import { BB_FEATURES } from '@/lib/ai/constants'
import { remainingCallsToday } from '@/lib/ai/usage'
import { processNext } from '@/lib/blackboard/ai/process'
import { createClient } from '@/lib/supabase/server'

// POST (no body) → one unit of Blackboard AI work (classify or extract key
// dates) as ProcessResult JSON. useBbProcessing calls it in a loop until
// `remaining` is 0. Login session only: this deliberately sits outside the
// public /api/blackboard prefix in proxy.ts. Calls count against the
// separate Blackboard budget (BB_DAILY_CALL_CAP, bb_* feature keys).

export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  if (process.env.AI_ENABLED === 'false') return NextResponse.json({ disabled: true, remaining: 0 })

  try {
    const result = await processNext(supabase, {
      userId: user.id,
      ai: async (request) => {
        const { data, model } = await generateStructuredWithUsage<unknown>(request)
        return { data, model }
      },
      budgetRemaining: () => remainingCallsToday(BB_FEATURES.extractDocument, supabase),
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('Blackboard processing failed:', err)
    return NextResponse.json({ error: 'process_failed' }, { status: 500 })
  }
}
