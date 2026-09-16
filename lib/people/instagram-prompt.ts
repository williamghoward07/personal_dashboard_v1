// Pure string builder for the Instagram log's "Copy Claude instructions"
// button (and the same rules the instagram-log Claude Code skill follows).
// No AI call happens here — the prompt is pasted, with screenshots, into
// Claude, and Claude's JSON reply is pasted back into the app.

export interface InstagramPromptInput {
  /** The day the screenshots were taken, YYYY-MM-DD. */
  capturedOn: string
  /** First import: record who's there without logging them as new. */
  baseline: boolean
}

export const INSTAGRAM_JSON_EXAMPLE = `{
  "captured_on": "2026-09-16",
  "baseline": false,
  "following": [
    { "username": "sam.k", "display_name": "Sam K", "approx_date": null }
  ],
  "followers": [
    { "username": "jo_b", "display_name": "Jo B", "approx_date": "2026-09-14" }
  ]
}`

export function buildInstagramPrompt({ capturedOn, baseline }: InstagramPromptInput): string {
  return [
    "I'm attaching screenshots from my own Instagram account. Turn them into JSON for my personal follow log.",
    '',
    'The screenshots can be:',
    '- my Following list, sorted by "Date followed: Latest" → put those accounts in "following"',
    '- my Followers list, or Activity notifications saying someone "started following you" → put those in "followers"',
    '',
    'Rules:',
    '- Copy each username exactly as shown (letters, numbers, "." and "_"), without the "@".',
    '- If a username is cut off or you can\'t read it with certainty, leave that account out. Never guess.',
    '- "display_name" is the name shown under or beside the username, or null.',
    `- The screenshots were taken on ${capturedOn}. If a notification shows a relative time ("2d", "3w", "Yesterday"), convert it to "approx_date" (YYYY-MM-DD) counting back from that date; otherwise use null.`,
    '- List each account once per list. Ignore suggested accounts, ads and "Follow back" prompts.',
    `- Set "captured_on" to "${capturedOn}" and "baseline" to ${baseline ? 'true' : 'false'}.`,
    '',
    'Reply with only the JSON, in this shape:',
    '',
    INSTAGRAM_JSON_EXAMPLE,
  ].join('\n')
}
