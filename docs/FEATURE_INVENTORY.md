# Feature Inventory — Study Copilot / Personal Dashboard

*Snapshot: 2026-09-01. Purpose: a plain-language map of everything that's
built, so I can decide what this "second brain" should actually be.
Take this into the Claude Project and brain-dump against it.*

---

## What it is today

A personal, single-user web dashboard (Next.js 16 + Supabase + Gemini,
deployed on Vercel). Bento-grid home screen, one module per life area,
a central AI query box. Dark-only "BIO-SYSTEM" theme. Google sign-in
only. Everything is behind login; every table is owner-scoped.

**Honest status:** the bones are ~80% there and more is working than it
feels like. What's missing is the thing that would make me *use* it —
it's laptop-only, has no offline mode, and capture is slow (open laptop
→ find module → open form → fill fields → save).

Status legend: ✅ works · ⚠️ works but rough · 🐛 known bug · 🚧 half-built ·
❌ not built · 👻 built but hidden

---

## Modules

### Home (`/`)
- ✅ Bento grid of 8 glance cards (Daily Goals, Education, Money, AI Usage,
  Research, Habits, People, Calendar). Each is live data, each links into
  its module.
- ✅/🐛 **AI query bar** — three modes, all built, but auto-detected with no
  visible selector or explanation (this is the confusing part):
  - **Find** — type a query, Gemini extracts keywords + which modules to
    search, then a plain text search runs (no AI in the actual lookup).
  - **Answer** — for question-shaped queries, an extra Gemini call
    summarises the results.
  - **Act** — "add a todo to email my tutor" → Gemini drafts it → I
    confirm → it's created (todo, education task, or calendar event).
- ✅/🐛 **Daily Goals card** — a ring ("5/8 today") over education tasks +
  follow-ups + habits, plus a general-todo checklist with inline add.
  Bug: the ring counts a table (`education_tasks`) that the Education
  module doesn't write to, so coursework deadlines never show here.
- ❌ Planned but not built: a quick-copy Prompt Library card; the People
  quick-add bar on the home screen (it's on `/people` instead); home-screen
  edit mode (drag widgets).

### Education (`/education`)
- ✅ Year → module tabs, Modules/Tasks toggle, "at-risk" task list, task
  cards with detail + time-tracking.
- ✅ **OneNote** — connect a Microsoft account, link a module to a OneNote
  section, list its pages. Pages open *in* OneNote (can't read handwriting
  via the API, so in-app reading was dropped).
- 🚧 Notes-doc → todos with a progress bar — code shipped, **DB migration
  not run**, so it shows "0 linked todos" until that's fixed.
- ✅ Perplexity research links inside modules (URL + note, manual only).
- ❌ **Dedicated research panel with saved conversation links** — this is
  build-list item #7, still not done.

### Money (`/money`)
- ✅ Overall balance, per-account cards, transactions list.
- ✅ **Starling** — live balances + Spaces, transaction sync.
- ✅/⚠️ **PDF bank-statement import** — generic parser, mandatory review
  step. Never tested on a real multi-year re-upload.
- 🐛 Hide-accounts — needs a migration applied on the live DB, and the
  headline balance still includes hidden accounts.
- ❌ Monzo (Trading212 was tried and removed). Spending-by-category
  drill-down, income-by-sender, move-transaction-between-categories,
  sender→category rules. Shrinking the oversized action buttons.

### Todos & Reminders (`/todos`)
- ✅ Todos with lists (colour chips), one level of subtasks, due-time,
  List / Extended / Completed views.
- 🐛 **Apple Reminders sync (CalDAV)** — pull works (reads iCloud
  reminders in), completion push works (marks them done in iCloud). But
  pull failures are silent, and there's **no way to create a reminder** —
  app todos stay app-only, nothing writes new items into Reminders.
- ❌ Natural-language "add a reminder" (vs todo), showing the reminder's
  time in the list, multi-select → move to another list.

### Habits (`/habits`)
- ✅ Daily / specific-day / X-times-per-week habits, completion heatmap,
  streaks. Health-type habits (Running/Gym rings) share the same system.

### Health (`/health`) 👻
- 👻 Running/Gym rings, manual activity logging, Strava **CSV** import
  (not a live API) — all written, all **hidden** right now with a note
  "Bevel already covers this, not worth the effort". Not in the nav.
- (There's an older plan to add a Fitbit integration + a Sleep widget,
  on hold pending the device — may be dead given Health is parked.)

### People / CRM (`/people`)
- ✅ Directory, interactions log, follow-ups, places, all with detail +
  form modals.
- ✅ **NL quick-add bar** — "met Sarah at the library, she does climate
  policy" → Gemini drafts a person/interaction/follow-up → I confirm.
- ✅ **Google Contacts** — two-way sync (pull + push one card back).
  Token dies every 7 days while the Google app is in "Testing" mode.

### Calendar (`/calendar`)
- ✅ Month / Week / Day grids (real 24-hour grid), Grid/Agenda toggle,
  hour-density zoom.
- ✅ **Google Calendar** (read-only; Google is the source of truth).
- ✅/🐛 **Routines** — build a template, drag it onto a day, it creates a
  real Google event. Bug: clicking a routine yanks the panel up the page.
- ✅ "Auto time-block today" wizard — suggests free slots, creates events.
- ❌ **No manual "add event" form at all** — events only come from AI Act,
  routines, or the time-block wizard.

### Bible (`/bible`)
- ✅ One active study at a time, session-by-session question walkthrough,
  topical index, passage lookup + notes. **Zero AI.** Studies imported by
  pasting JSON. A prompt launcher builds a copyable prompt for a separate
  Claude Project (this is the "app assembles context, I think in Claude"
  pattern).

### Research / Prompt Library (`/research`)
- ✅ Prompt cards (click to copy), Perplexity link store (foldered).
- ❌ No search box (despite being called "searchable"), no "auto-organize",
  no home quick-copy card.

### Brain Dump (`/brain-dump`)
- ✅ Paste a paragraph → Gemini splits it into multiple typed drafts
  (todos, tasks, people, events) → confirm each. **This is the closest
  thing to frictionless capture that already exists** — it just isn't
  surfaced anywhere prominent.

### AI (`/ai-usage`)
- ✅ Every Gemini call is logged with real token counts + cost estimate.
  Daily cap of 200 calls. Usage page + home glance.
- ❌ A widget showing Claude session/weekly limits.

---

## What's decided about direction (2026-09-01)

- **Phone = PWA**, not a native app (native needs a paid Apple developer
  account, which I won't buy). Install to home screen, offline reads +
  queued writes, push, share-sheet capture.
- **Keep Gemini**, fix its UX (explicit modes, better prompts).
- **Capture-first is the priority** — a Quick Capture box everywhere, plus
  "Alexa/Siri → Apple Reminders → pulls into the app".
- It has to *remove* friction, not add it.

Full roadmap: `.claude/plans/do-a-comprehensive-look-mutable-church.md`

---

## Brain-dump prompts (things to decide)

1. What do I actually want to capture on the move, and where should it
   land? (todos, fleeting notes, links, reading, ideas, people…)
2. Which of these modules do I genuinely want, and which are noise?
   Candidates to cut/park: Health, Bible-in-app, the depth of the CRM,
   Strava CSV, PDF statement import.
3. What do I want to *recall*, and how? (search, a daily view, a weekly
   review…)
4. What's the one screen I'd want on my phone's home screen?
5. Where does Claude fit — in-app, or "app builds a prompt, I think in
   Claude, paste back" (like the Bible module)?
6. What would make me open this tomorrow morning?
