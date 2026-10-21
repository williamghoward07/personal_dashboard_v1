import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GraphApiError, getAccessToken } from '@/lib/microsoft/graph'
import { MICROSOFT_ONENOTE_PROVIDER, hasCalendarScope, hasTodoScope } from '@/lib/microsoft/oauth'
import { createTask, getDefaultListId } from '@/lib/microsoft/todo'
import { createEvent } from '@/lib/microsoft/calendar'
import { describeReminder, parseReminder, reminderToEventBody, reminderToTaskBody } from '@/lib/alexa/reminder'
import { isFreshTimestamp, verifyAlexaSignature } from '@/lib/alexa/verify'
import type { Integration } from '@/lib/types'

// The private Alexa skill's endpoint: "Alexa, tell Study Copilot to remind
// me tomorrow at 3pm to do the washing up" -> a Microsoft To Do task (due
// date + reminder, so the phone alerts) and an Outlook event. Alexa is voice
// input only; nothing is created in Alexa's own reminders.
//
// There's no Supabase session on this request (Alexa is the caller), so the
// route is public in proxy.ts and protects itself: Amazon's signature +
// timestamp, then the skill id and the Amazon user id must match env vars.
// Writes use the owner's stored Microsoft connection via the service-role
// client, scoped by ALEXA_OWNER_USER_ID. The task lands in To Do and comes
// into the app on the next pull (/api/microsoft/todo/pull) like any To Do task.

interface AlexaSlot {
  value?: string
}

interface AlexaRequestBody {
  session?: { application?: { applicationId?: string }; user?: { userId?: string } }
  context?: { System?: { application?: { applicationId?: string }; user?: { userId?: string } } }
  request?: {
    type?: string
    timestamp?: string
    intent?: { name?: string; slots?: Record<string, AlexaSlot | undefined> }
  }
}

function speak(text: string, endSession = true) {
  return NextResponse.json({
    version: '1.0',
    response: { outputSpeech: { type: 'PlainText', text }, shouldEndSession: endSession },
  })
}

const HELP =
  'Say: remind me tomorrow at 3pm to do the washing up. I will add it to To Do and your calendar.'

export async function POST(request: Request) {
  const rawBody = await request.text()

  const verified = await verifyAlexaSignature({
    rawBody,
    certChainUrl: request.headers.get('signaturecertchainurl'),
    signature: request.headers.get('signature-256'),
  })
  if (!verified) return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })

  let body: AlexaRequestBody
  try {
    body = JSON.parse(rawBody) as AlexaRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (!isFreshTimestamp(body.request?.timestamp, new Date())) {
    return NextResponse.json({ error: 'stale_request' }, { status: 400 })
  }

  const skillId = process.env.ALEXA_SKILL_ID
  const allowedUserId = process.env.ALEXA_ALLOWED_USER_ID
  const ownerId = process.env.ALEXA_OWNER_USER_ID
  if (!skillId || !allowedUserId || !ownerId) {
    console.error('Alexa skill env vars are not set (ALEXA_SKILL_ID / ALEXA_ALLOWED_USER_ID / ALEXA_OWNER_USER_ID)')
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }
  const applicationId = body.session?.application?.applicationId ?? body.context?.System?.application?.applicationId
  const amazonUserId = body.session?.user?.userId ?? body.context?.System?.user?.userId
  if (applicationId !== skillId || amazonUserId !== allowedUserId) {
    // Only Amazon-signed requests reach here, so the ids are safe to log —
    // this is how you find ALEXA_ALLOWED_USER_ID on first setup.
    console.warn(`Alexa request rejected: applicationId=${applicationId} userId=${amazonUserId}`)
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const type = body.request?.type
  if (type === 'SessionEndedRequest') return new NextResponse(null, { status: 200 })
  if (type === 'LaunchRequest') return speak(HELP, false)
  if (type !== 'IntentRequest') return speak(HELP)

  const intent = body.request?.intent
  switch (intent?.name) {
    case 'RemindIntent':
      return handleRemind(intent.slots ?? {}, ownerId)
    case 'AMAZON.HelpIntent':
      return speak(HELP, false)
    case 'AMAZON.StopIntent':
    case 'AMAZON.CancelIntent':
      return speak('Okay.')
    default:
      return speak(HELP)
  }
}

async function handleRemind(slots: Record<string, AlexaSlot | undefined>, ownerId: string) {
  const now = new Date()
  const parsed = parseReminder(
    { date: slots.date?.value, time: slots.time?.value, task: slots.task?.value },
    now,
  )
  if (!parsed.ok) return speak(parsed.speech)
  const { reminder } = parsed

  const supabase = createAdminClient()
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', ownerId)
    .eq('provider', MICROSOFT_ONENOTE_PROVIDER)
    .maybeSingle<Integration>()

  if (!integration?.encrypted_refresh_token || !hasTodoScope(integration.scopes)) {
    return speak('Microsoft To Do is not connected. Connect it in the dashboard first.')
  }

  let accessToken: string
  try {
    accessToken = await getAccessToken(integration)
  } catch (error) {
    console.error('Alexa reminder: Microsoft sign-in failed:', error)
    return speak('I could not sign in to Microsoft. Reconnect it in the dashboard.')
  }

  // Task first (the point of the reminder); the calendar event is best
  // effort and reported separately so one failure doesn't hide the other.
  try {
    await createTask(accessToken, await getDefaultListId(accessToken), reminderToTaskBody(reminder))
  } catch (error) {
    console.error('Alexa reminder: To Do create failed:', error)
    return speak('I could not add that to To Do, so nothing was saved.')
  }

  const description = describeReminder(reminder, now)
  if (!hasCalendarScope(integration.scopes)) {
    return speak(`Added to To Do: ${description}. The calendar event was skipped. Reconnect Microsoft in the dashboard to allow it.`)
  }
  try {
    await createEvent(accessToken, reminderToEventBody(reminder))
  } catch (error) {
    console.error('Alexa reminder: Outlook event create failed:', error)
    const needsReconnect = error instanceof GraphApiError && (error.status === 401 || error.status === 403)
    return speak(
      `Added to To Do: ${description}. The calendar event failed${needsReconnect ? '. Reconnect Microsoft in the dashboard' : ''}.`,
    )
  }
  return speak(`Done: ${description}.`)
}
