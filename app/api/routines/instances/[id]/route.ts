import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteGoogleCalendarEvent } from '@/lib/google/calendar'
import { GoogleReauthRequiredError } from '@/lib/google/token'

// Deletes one scheduled routine occurrence: removes the real Google
// Calendar event, then the routine_instances row. The routine template
// itself (routines/routine_items) is untouched — this only removes one
// placement, not the reusable stack it came from.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: instance, error: fetchError } = await supabase
    .from('routine_instances')
    .select('google_event_id')
    .eq('id', id)
    .single()

  if (fetchError || !instance) {
    return NextResponse.json({ error: 'instance_not_found' }, { status: 404 })
  }

  try {
    await deleteGoogleCalendarEvent(instance.google_event_id)
  } catch (err) {
    if (err instanceof GoogleReauthRequiredError) {
      return NextResponse.json(
        { error: 'google_reauth_required', message: 'Reconnect Google Calendar (from the Calendar page) to delete scheduled routines.' },
        { status: 409 }
      )
    }
    console.error('Routine instance Google event deletion failed:', err)
    return NextResponse.json({ error: 'google_delete_failed' }, { status: 500 })
  }

  const { error: deleteError } = await supabase.from('routine_instances').delete().eq('id', id)
  if (deleteError) {
    return NextResponse.json({ error: 'instance_delete_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
