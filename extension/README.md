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

It follows the NorthStar-style panel spec: warm base colours with one terracotta accent, light/dark that follows the system, and a manual toggle. It's separate from the dashboard's DESIGN.md.

- **Header:** connection chip. On open it does one `users/me` check: "Blackboard connected" or "Not logged in".
- **Strip:** the round button syncs. Course chips open a detail card with counts and Open in Blackboard.
- **Overview:** Sync now, last sync, what was found, and how Blackboard was reached ("In the background" = the service worker's own requests worked; "Through your open tab" = it needed the content-script fallback).
- **Courses:** one card per course, modules first.
- **Running now:** the five-step roadmap and step list, then the result card.

The sync runs in the service worker, not the panel. Closing the panel or switching tabs doesn't stop it, and reopening the panel picks up the run in progress (state is in `chrome.storage.session`).

Badge: `!` = log in to Blackboard, `?` = another error, `…` = syncing.

Nothing is sent to the dashboard yet (phase 2). **Download JSON** saves the raw snapshot.
