# Bugs and backlog

Moved out of `CLAUDE.md` on 2026-10-01.

## Bugs (bounded, fix first)
- Money: hidden accounts are not actually hidden — the toggle saves
  `is_hidden`, but nothing filters on it (and the headline balance still
  includes them). *Re-verify: `MoneyBoard.tsx` now filters `is_hidden` in the
  account list; the headline balance is unchecked.*
- Calendar routines: clicking a routine causes the panel to jump far up the
  page while the mouse hovers the tab; it snaps back to the correct centred
  position only when the window loses focus. (Reported; not re-verified.)

## Backlog
- **Blackboard**: a picker to attach an item to a session by hand (the
  override exists; only hide / restore have UI); an "Open source" link on
  the session page's announcement lines; `npm run bb:eval` can't log to
  `ai_usage` until `20261113010000_ai_usage_service_role.sql` is applied;
  the handbook download (now from an Ultra Document's body, 13 Nov 2026)
  and PDF text extraction in the extension's service worker are untested
  in a real browser.
- **Tooling**: the GitHub repo's homepage link points at a deleted Vercel
  address (`personal-dashboard-v1-beta.vercel.app`, 404);
  pre-existing eslint errors
  (`react-hooks/set-state-in-effect`) in about 36 older component files.
- **Money**: shrink "Add account", "Hidden accounts" and "Import PDF
  statement" (too dominant); per-category spending breakdown with
  drill-down to transactions; a monthly income breakdown by sender; move a
  transaction to another (or a new) category, and persistent
  sender → category rules.
- **Todos**: multi-select and move to another/new list; "add a reminder"
  wording in capture.
- **Education**: reconcile `tasks` / `education_tasks`; a dedicated research
  panel with saved conversation links.
- **Calendar**: the basic Google Calendar event options when adding an event
  (all-day vs timed, etc.).
- **Home**: edit mode (drag widgets to chosen positions, saved per user),
  after the density overhaul decision; a whole-app UI pass using the
  Perplexity home screen as the visual reference; a widget for Claude
  session/weekly usage (no source for that data identified yet).
- **Platform**: web push notifications to the phone (PWA). Approach
  undecided.

