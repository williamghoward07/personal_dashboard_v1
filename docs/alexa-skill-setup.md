# Alexa reminder skill — setup

A private skill (developer mode, your own account only) so that

> "Alexa, tell Study Copilot to remind me tomorrow at 3pm to do the washing up"

creates a Microsoft To Do task (due date + reminder, so the phone alerts) and an
Outlook calendar event. Alexa is voice input only — nothing goes into Alexa's
own reminders (skills can't read native "Alexa, remind me…" reminders, and
Amazon has no webhook for them). Code: `app/api/alexa/route.ts`,
`lib/alexa/`.

Native "Alexa, remind me…" still works as before; it just doesn't sync.

## One-time setup

1. **Azure**: app registration -> API permissions -> add delegated
   `Calendars.ReadWrite`.
2. **Reconnect Microsoft** once in the app (Todos page -> Connect), so the
   stored token includes the calendar scope. Until then a spoken reminder still
   makes the To Do task, and Alexa says the calendar event was skipped.
3. **Alexa developer console** (developer.amazon.com/alexa/console/ask, same
   Amazon account as your Echo): Create skill -> Custom -> *Provision your own*
   (no hosting), locale **English (UK)**.
4. **Interaction model** -> JSON Editor: paste `docs/alexa-skill-model.json`,
   Save, Build.
5. **Endpoint**: HTTPS, `https://<your-production-domain>/api/alexa`, SSL type
   "trusted certificate authority" (Vercel). Copy the **Skill ID**.
6. **Env vars** (Vercel + `.env.local`):
   - `ALEXA_SKILL_ID` — from the console.
   - `ALEXA_OWNER_USER_ID` — your Supabase `auth.users` id.
   - `ALEXA_ALLOWED_USER_ID` — your Amazon user id. Leave it as any placeholder,
     say the phrase once, then copy the `userId` from the "Alexa request
     rejected" line in the Vercel logs.
7. Test tab -> enable testing in **Development**. The skill is then live on
   your own Echo devices; no certification or publishing.

## Caveats
- Alexa+ (from March 2026) has made "tell <skill> …" unreliable for some
  skills. If Study Copilot isn't picked up, say "Alexa, open Study Copilot" and
  then the reminder.
- Outlook events don't show on the app's Calendar page (it reads Google only).
- The date and time must be specific ("tomorrow", "3pm"); a vague one
  ("morning", "next week") gets a spoken re-ask, nothing is guessed.
- Fallback if "tell <skill>" stops working: Alexa adds a calendar event and
  the site mirrors it into To Do (not built).
