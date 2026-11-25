// Runs in Blackboard tabs. Tells the worker about each page load (the
// on-visit trigger), and is the fallback when the service worker's own
// requests don't carry the session cookie: the worker asks an open tab to do
// the work, since requests from here are first-party to Blackboard. File
// downloads can't use this path (their redirect to *.blackboard.com is
// cross-origin and has no CORS), so documents are only read from the worker.
import { BbLoginRequiredError, getMe, snapshot } from '@/lib/blackboard/client'
import {
  browserFetch,
  errorMessage,
  type ContentCheckReply,
  type ContentMessage,
  type ContentReply,
  type WorkerMessage,
} from './shared'

const failure = (err: unknown) => ({
  ok: false as const,
  loginRequired: err instanceof BbLoginRequiredError,
  error: errorMessage(err),
})

// One "visit" per page load (Ultra is a single-page app, so this is rare).
// The worker decides whether that starts a sync (none attempted in 6 h).
// Login and other non-Ultra pages don't count: a sync from there would only
// fail and hold off the next try for 6 hours.
if (location.pathname.startsWith('/ultra')) {
  void chrome.runtime.sendMessage<WorkerMessage>({ type: 'visit' }).catch(() => {})
}

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  if (message?.type === 'bb-check') {
    const reply = (r: ContentCheckReply) => sendResponse(r)
    getMe(browserFetch).then((me) => reply({ ok: true, userName: me.userName }), (err) => reply(failure(err)))
    return true
  }
  if (message?.type === 'bb-snapshot') {
    const reply = (r: ContentReply) => sendResponse(r)
    snapshot(browserFetch, {
      onProgress: (progress) =>
        void chrome.runtime.sendMessage<WorkerMessage>({ type: 'progress', progress }).catch(() => {}),
    }).then((snap) => reply({ ok: true, snapshot: snap }), (err) => reply(failure(err)))
    return true
  }
})
