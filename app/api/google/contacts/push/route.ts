import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import { GOOGLE_CONTACTS_PROVIDER, refreshAccessToken } from '@/lib/google/oauth'
import { updateContact } from '@/lib/google/people'
import type { Integration, Person } from '@/lib/types'

/**
 * Pushes one person's contact-card edit (name, email, phone, company/role,
 * LinkedIn) back to Google. Called after a local save on a Google-linked
 * person; a failure here never rolls back the local save — the caller
 * treats this as best-effort and surfaces a non-blocking error instead.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { personId } = (await request.json()) as { personId?: string }
  if (!personId) {
    return NextResponse.json({ error: 'personId is required' }, { status: 400 })
  }

  const { data: person } = await supabase.from('people').select('*').eq('id', personId).maybeSingle<Person>()
  if (!person?.google_resource_name) {
    return NextResponse.json({ error: 'This person is not linked to a Google contact' }, { status: 400 })
  }

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', GOOGLE_CONTACTS_PROVIDER)
    .maybeSingle<Integration>()

  if (!integration?.encrypted_refresh_token) {
    return NextResponse.json({ error: 'Google Contacts is not connected' }, { status: 400 })
  }

  try {
    const refreshToken = decryptSecret(integration.encrypted_refresh_token)
    const tokens = await refreshAccessToken(refreshToken)

    const { etag } = await updateContact({
      accessToken: tokens.access_token,
      resourceName: person.google_resource_name,
      full_name: person.full_name,
      email: person.email,
      phone: person.phone,
      company: person.company,
      job_title: person.job_title,
      linkedin_url: person.linkedin_url,
    })

    await supabase
      .from('people')
      .update({ google_etag: etag, google_synced_at: new Date().toISOString() })
      .eq('id', person.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Missing the write scope reads as a 403 from Google — the common cause
    // is an account still connected under the old contacts.readonly scope.
    const message =
      error instanceof Error && /invalid_grant/i.test(error.message)
        ? 'Google sign-in expired — click Reconnect to re-authorise.'
        : error instanceof Error && /403/.test(error.message)
          ? "Google refused the update — click Reconnect to grant write access to Contacts."
          : error instanceof Error
            ? error.message
            : 'Unknown error pushing to Google'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
