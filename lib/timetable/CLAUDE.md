# Timetable (lecture prep)

- Source: the Durham MyTimetable ICS feed in `TIMETABLE_ICS_URL` (server-only; a private link). Read directly, not through Google: Google refreshes subscribed calendars only every 12–24h and its token lapses weekly while the OAuth app is in Testing.
- `feed.ts` caches the parsed feed in memory for 1h per server instance and serves the last good copy if a refresh fails.
- Titles look like `GEOG1081: Physical Geography - Lecture`; `parseSessionTitle` splits code / module / type. The code links a session to its module workspace (`workspaces.module_code`).
- A session's identity is its ICS UID (Durham gives each occurrence its own). Recurring events, if a feed ever has them, are expanded to `${uid}#${start}`. Never key prep on time or title — sessions move.
- The timetable is never stored. `lecture_sessions` (prep handed in = `prep_done_at`, follow-up done = `notes_done_at`, note; `no_readings` is retired, backfilled into `prep_done_at`), module readings (`workspace_links.session_uid`) and `session_tasks` (phase `prep` = tasks before, `post` = concepts to review after; a `url` makes a task a reading) are keyed by UID.
- Prep is handed in like a Teams assignment: green only after Mark as done (`prep_done_at`), never from ticks alone. Undo clears `prep_done_at` and `no_readings`.
- The traffic light is split. Left half, `prepStatus`: red = nothing added and not handed in, amber = added but not handed in, green = handed in. Right half, `postStatus`: `pending` (neutral) until handed in, then green = marked done or every concept ticked, amber = concepts outstanding, red = ended with nothing recorded. Follow-up only shows once handed in.
- `isOverdue` = ended and prep not handed in. Follow-up has no due date and never counts. `assignmentLists` builds /lectures' Upcoming / Past due / Completed / History tabs.
- Clicking a session opens `/lectures/session?uid=…` (`sessionHref`), a query param because UIDs carry `@` and dots. Only timetable sessions have it; Google events stay in the calendar popover.
- Google events can be tracked too: off by default, switched on per event in its popover (`lecture_sessions.tracked`, uid `gcal:<event id>`). `/api/timetable` returns their prep as `tracked`; the calendar joins it to the Google events it already has (`calendarEventSession`). Only same-day timed events become prep items. They have no module code, so a pasted link stays a `session_tasks` row.
- Talis and Blackboard are 2FA-locked: readings are pasted links, never fetched.
