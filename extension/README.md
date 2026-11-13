# Blackboard Sync (Chrome extension)

A private, unpacked extension that reads my own Blackboard Ultra data with my logged-in session. Read-only. Spec: `docs/specs/blackboard-sync-spec.md`. Blackboard logic: `lib/blackboard/client.ts`.

## Install

```bash
npm run build:extension
```

1. Open `chrome://extensions` and switch on **Developer mode**.
2. **Load unpacked** → choose this `extension/` folder.
3. Pin it. Clicking the icon opens the **side panel**.

After changing code, rebuild and press the reload icon on the extension's card. Reload any open Blackboard tabs too, so they pick up the new content script.

## Side panel

Warm base colours with one terracotta accent; light or dark follows the system. It's separate from the dashboard's DESIGN.md. Each function appears once.

- **Header:** connection status. On open it does one `users/me` check: "Blackboard connected" or "Not logged in".
- **Not connected banner:** at the top of both tabs while no dashboard address + token is saved ("nothing is being saved").
- **Overview:** one card with Sync now and, for the last run, in plain words: the trigger and time, Blackboard read (Read / Login needed / Error), what was found, the upload (row counts and size, or the exact error), documents (read / unchanged / skipped / failed, with file names and reasons), the next daily sync and the last automatic sync. While syncing, or after a failure, it shows the one progress bar (five steps, horizontal) with a line of text under it. "Read in the background" means the service worker's own requests worked; "Read through your open Blackboard tab" means it needed the content-script fallback.
- **Courses:** one card per course, modules first, each with Open.

The sync runs in the service worker, not the panel. Closing the panel or switching tabs doesn't stop it, and reopening the panel picks up the run in progress (state is in `chrome.storage.session`).

Badge: `!` = log in to Blackboard, `?` = another error, `…` = syncing.

## Triggers

- **Sync now** (`manual`).
- **Daily** (`daily`): a `chrome.alarms` alarm every 24 h, recreated on install / browser start when Chrome dropped it (first run a day after the last success, or a minute from now if that has passed). Skipped when a successful sync finished in the last 20 h.
- **On visit** (`visit`): the content script reports each Blackboard `/ultra` page load; a sync starts only when none was attempted in the last 6 h.
- Never two at once: an in-memory guard plus `syncStartedAt` in `chrome.storage.local` (10-minute timeout, so it survives a worker restart).
- Automatic runs are silent: logged out sets the `!` badge and waits for the next trigger.

## Handbooks and briefs

After a successful upload the dashboard's reply lists `wanted` content items. For each, the worker lists the item's attachments (GET), reads only PDF and Word files (never pptx), skips ones whose version (the item's `modified`) the dashboard already has, downloads at most 30 per sync (15 MB cap, checked while streaming), extracts the text in the worker (PDF: `unpdf`; Word: `lib/blackboard/docx-text.ts`) and POSTs only the text to `/api/blackboard/document`. File bytes and text are never stored; the last-run record keeps counts and file names. Downloads follow Blackboard's redirect to `*.blackboard.com`, which needs that host permission, and only work from the worker (not the tab fallback).

**Dashboard:** after a successful snapshot the worker POSTs `{ trigger, snapshot }` to `<dashboard>/api/blackboard/sync` with `Authorization: Bearer <token>`, gzipped (`Content-Type: application/gzip`) when the browser has `CompressionStream`. A snapshot that failed part-way is never sent. Set it up once in the Dashboard card: the address (e.g. your Vercel URL, or `http://localhost:3000`) and the value of `BLACKBOARD_SYNC_TOKEN`. Saving asks Chrome for permission to that one origin (`optional_host_permissions`). The overview's **Dashboard** row says whether the last sync was saved; a failure also sets the `?` badge.

**Download JSON** saves the raw snapshot.
