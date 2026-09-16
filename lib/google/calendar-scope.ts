// Shared between lib/google/connect.ts ('use client' — the consent
// request) and app/auth/callback/route.ts (server — records what was
// granted). A separate file so the server callback doesn't need to import
// a 'use client' module just for this constant.
//
// Read/write events on the primary calendar — not the broader `calendar`
// scope, which would also grant managing calendar list/settings
// themselves. Needed so Capture (query box / Brain Dump) can create real
// events, not just read today's. Anyone connected under the old .readonly
// scope needs to hit Reconnect once to re-consent.
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
