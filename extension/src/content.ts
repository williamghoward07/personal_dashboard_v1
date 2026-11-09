// Runs in Blackboard tabs. Only used as a fallback: when the service worker's
// own requests don't carry the session cookie, it asks an open tab to do the
// work, since requests from here are first-party to Blackboard.
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
