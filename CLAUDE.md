# Study Copilot

Personal, single-user dashboard for daily use as a university Geography student.
Not a demo project — built for my own real use. Bento-grid layout, no module
(academic/finance/fitness) visually dominates another. Central AI query box
connects across modules.

## Design philosophy
- Equally weighted, self-contained widget cards in a bento-grid
- Desktop/web-first, designed for 1440px+ screens (current priority)
- Mobile companion app is a future phase — explicitly out of scope now
- Research prompts library is standalone, not nested under academics
- Notion-style tailored views per task (e.g. clicking an essay shows a
  bespoke checklist for that task, not a generic template)
- CSS/theming/branding is being deferred — don't worry about polish yet,
  focus on structure and function first

## Tech stack
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend/Auth/DB: Supabase
- Deployment: Vercel
- AI: Anthropic API (console.anthropic.com) for in-app research panel

## Features (build order — easiest to hardest)
1. App shell with placeholder slots for every feature
2. Deadline/checklist view (own DB table, no external API)
3. Manual time tracking + progress visual
4. Manual rugby session logging
5. Calendar API integration for day view
6. Strava API (running + Hevy-synced gym sessions)
7. Claude API research panel with saved conversation links
8. Monzo/Starling integration (read-only scopes, encrypted token storage)
9. (Optional stretch) One-way sync to Apple Reminders via CalDAV

## Decided / out of scope for v1
- No push/email notifications — in-app only, not building for mobile yet
- No data export feature — Supabase's own export covers this
- Perplexity integration is manual link-saving only (no public API available),
  just a URL + note field attached to a task
- Apple Reminders stays as-is on the phone widget — no in-app replication