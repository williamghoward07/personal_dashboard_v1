import 'server-only'
import { graphRequest } from './graph'

// Outlook calendar via Graph (/me/events). Delegated Calendars.ReadWrite on
// a personal account. Write-only for now: used by the Alexa reminder skill
// (app/api/alexa) — the app's Calendar page still reads Google only.

export interface GraphEvent {
  id: string
  webLink?: string
}

/** Create an event on the default calendar. Body is a Graph `event`. */
export async function createEvent(accessToken: string, body: Record<string, unknown>): Promise<GraphEvent> {
  const created = await graphRequest<GraphEvent>(accessToken, '/me/events', { method: 'POST', body })
  if (!created) throw new Error('Outlook returned no event after create')
  return created
}
