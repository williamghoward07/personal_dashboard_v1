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
- **Overview:** one card with Sync now, last sync and what was found. While syncing, or after a failure, it shows the one progress bar (five steps, horizontal) with a line of text under it. "Read in the background" means the service worker's own requests worked; "Read through your open Blackboard tab" means it needed the content-script fallback.
- **Courses:** one card per course, modules first, each with Open.

The sync runs in the service worker, not the panel. Closing the panel or switching tabs doesn't stop it, and reopening the panel picks up the run in progress (state is in `chrome.storage.session`).

Badge: `!` = log in to Blackboard, `?` = another error, `…` = syncing.

Nothing is sent to the dashboard yet (phase 2). **Download JSON** saves the raw snapshot.
