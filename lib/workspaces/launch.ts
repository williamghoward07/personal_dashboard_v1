// Opening a whole working set from one click. Browsers' pop-up blockers
// usually let only the first window.open() through per user gesture, so
// the caller needs to know which tabs didn't open to offer a way to open
// the rest (one click each, or after allowing pop-ups for the site).
//
// No 'noopener' feature string here on purpose: with it, window.open()
// returns null even on success, so a blocked tab would be indistinguishable
// from an opened one. The opener link is severed by hand instead.

export interface LaunchResult {
  opened: number
  blocked: string[]
}

type WindowOpen = (url: string, target: string) => Window | null

export function openOne(url: string, open: WindowOpen = (u, t) => window.open(u, t)): boolean {
  const tab = open(url, '_blank')
  if (!tab) return false
  try {
    tab.opener = null
  } catch {
    // Cross-origin quirks — the tab still opened, which is what matters.
  }
  return true
}

export function launchLinks(urls: string[], open?: WindowOpen): LaunchResult {
  const blocked: string[] = []
  let opened = 0
  for (const url of urls) {
    if (openOne(url, open)) opened++
    else blocked.push(url)
  }
  return { opened, blocked }
}
