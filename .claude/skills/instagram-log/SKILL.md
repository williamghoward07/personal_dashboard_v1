---
name: instagram-log
description: Turn Instagram screenshots (Following list sorted by newest, or "started following you" notifications) into the JSON the Study Copilot People → Instagram log imports. Use when the user shares Instagram screenshots and wants to update their follow log.
---

# Instagram log import

Reads screenshots of the user's **own** Instagram account and outputs the JSON that
People → Instagram log → **Import** accepts (`lib/people/instagram-import.ts`,
applied by the `import_instagram_snapshot` database function).

Never open, browse, log in to or automate Instagram. Automated access breaks
Instagram's terms and risks the account. Work only from screenshots the user gives you.

## Steps

1. Get the screenshots. If the user hasn't said where they are, ask for the file
   paths or folder. Read each image with the Read tool.
2. Ask for the date the screenshots were taken if it isn't obvious. Default to today.
3. Ask whether this is their **first** import. If it is, set `"baseline": true`, so
   everyone already there is recorded without being logged as new.
4. Sort each account into a list:
   - Following list (sorted "Date followed: Latest") → `following`
   - Followers list, or Activity "started following you" notifications → `followers`
5. Extract each account:
   - `username`: exactly as shown, without `@`. Only letters, digits, `.` and `_`.
     If it's cut off or you can't read it with certainty, **leave the account out**.
     Never guess.
   - `display_name`: the name shown with it, or `null`.
   - `approx_date`: if a notification shows a relative time ("2d", "3w",
     "Yesterday"), convert it to `YYYY-MM-DD` counting back from the capture date.
     Otherwise `null`.
   - Skip suggested accounts, ads and "Follow back" prompts. List each account once
     per list.
6. Reply with the JSON in a single ```json block, then one line telling the user to
   paste it into **People → Instagram log → Import**. The app previews what will be
   added before anything is saved.

## Output shape

```json
{
  "captured_on": "2026-09-16",
  "baseline": false,
  "following": [
    { "username": "sam.k", "display_name": "Sam K", "approx_date": null }
  ],
  "followers": [
    { "username": "jo_b", "display_name": "Jo B", "approx_date": "2026-09-14" }
  ]
}
```

Unfollows are never inferred. A screenshot only shows part of a list, so don't
mention or list people who are missing from it.
