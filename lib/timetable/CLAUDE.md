# Timetable (lecture prep)

- Source: the Durham MyTimetable ICS feed in `TIMETABLE_ICS_URL` (server-only; a private link). Read directly, not through Google: Google refreshes subscribed calendars only every 12–24h and its token lapses weekly while the OAuth app is in Testing.
- `feed.ts` caches the parsed feed in memory for 1h per server instance and serves the last good copy if a refresh fails.
- Titles look like `GEOG1081: Physical Geography - Lecture`; `parseSessionTitle` splits code / module / type. The code links a session to its module workspace (`workspaces.module_code`).
- A session's identity is its ICS UID (Durham gives each occurrence its own). Recurring events, if a feed ever has them, are expanded to `${uid}#${start}`. Never key prep on time or title — sessions move.
- The timetable is never stored. `lecture_sessions` (notes taken, no readings, note) and readings (`workspace_links.session_uid`) are keyed by UID.
- Traffic light (`prepStatus`) is prep only: red = no readings, amber = some unread, green = all read or "no readings". Notes taken is shown separately.
- Talis and Blackboard are 2FA-locked: readings are pasted links, never fetched.
