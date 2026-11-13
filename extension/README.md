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

Badge: `!` = log in to Blackboard, `?` = another error, `…` = syncing, `TEST` = syncs go to Test (nothing wrong).

**Dashboard:** after a successful snapshot the worker POSTs it to `<dashboard>/api/blackboard/sync` with `Authorization: Bearer <token>`. A snapshot that failed part-way is never sent. The Dashboard card holds two targets, **Live** (the Vercel site) and **Test** (`http://localhost:3000` or a preview URL), each with its own address and `BLACKBOARD_SYNC_TOKEN`, entered once. The Live | Test switch picks where syncs go; Test can't reuse Live's address. Saving asks Chrome for permission to that one origin (`optional_host_permissions`). A single dashboard saved before Live/Test becomes Live.

So a test run is never an accident: the Sync button names the target ("Sync to Live" / "Sync to localhost:3000"), Test shows a chip in the header and the `TEST` badge, and syncing to Test asks first in a dialog. The overview's **Dashboard** row says where the last sync went and whether it was saved; a failure also sets the `?` badge. If Test doesn't answer (dev server not running), it offers **Switch to Live**.

**Download JSON** saves the raw snapshot.
