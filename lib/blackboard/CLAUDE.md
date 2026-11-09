# Blackboard sync

Spec: `docs/specs/blackboard-sync-spec.md`. Phase 1 (the extension spike) is built. Nothing reaches the dashboard yet.

- `client.ts` is the only Blackboard code. It's pure: fetch is injected, and it's bundled into the Chrome extension (`extension/`, `npm run build:extension`). It must stay free of `server-only`, Next and Supabase imports.
- It runs in my logged-in browser and rides Blackboard's session cookie. Never handle passwords, 2FA, or the OAuth token that Ultra's page exchanges (`oauth2/tokeninfo`).
- GET only. Never submit, post or mark anything on Blackboard.
- Links and metadata only. Never download files.
- Always use absolute URLs (`absoluteUrl`): the Ultra page's `<base href>` points at a CloudFront CDN.
- The To Do feed (`/learn/api/v1/calendars/todo/studentItems`) rejects windows of 28 days or more. Use `todoWindows` (14 days).
- To Do items have no id (`{ title, dueDate, column, contentVisibility }`). Key them with `todoItemKey`.
- A lost session anywhere aborts the whole snapshot (`BbLoginRequiredError`). Never sync a partial snapshot: the server will mark missing rows removed.
- Org courses (`X_*_2026`) have no module code (`parseCourseCode`).
- Keep requests gentle (`delayMs`, default 150). A full sync is about 320 requests in about 2 minutes.
