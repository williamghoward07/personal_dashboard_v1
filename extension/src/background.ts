// Service worker. Sync takes a raw snapshot, stores it locally, reports
// progress for the side panel, and POSTs the finished snapshot to the
// dashboard (/api/blackboard/sync) when one is set up. A snapshot that
// failed part-way is never sent.
import {
  BB_ORIGIN,
  BbLoginRequiredError,
  getMe,
  snapshot,
  summariseSnapshot,
  type BbSnapshot,
  type SnapshotProgress,
} from '@/lib/blackboard/client'
import {
  STORAGE,
  SYNC_PATH,
  browserFetch,
  errorMessage,
  type ContentCheckReply,
  type ContentMessage,
  type ContentReply,
  type DashboardConfig,
  type LastRun,
  type SessionCheck,
  type SyncState,
  type SyncVia,
  type UploadResult,
  type WorkerMessage,
} from './shared'

// Clicking the toolbar icon opens the side panel, which stays open across tabs.
const openPanelOnClick = () => void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
chrome.runtime.onInstalled.addListener(openPanelOnClick)
chrome.runtime.onStartup.addListener(openPanelOnClick)

let running: Promise<LastRun> | null = null
let startedAt = ''
let currentStage: SyncState['stage'] = 'session'
let courseCount: number | undefined

chrome.runtime.onMessage.addListener((message: WorkerMessage, sender, sendResponse) => {
  switch (message?.type) {
    case 'sync':
      running ??= runSync().finally(() => {
        running = null
      })
      void running.then(sendResponse)
      return true // reply asynchronously
    case 'check':
      void checkSession().then(sendResponse)
      return true
    case 'progress':
      if (sender.tab && running) void writeState('tab', message.progress.stage, message.progress)
      return
  }
})

// Every write is an extension API call, which also stops the worker from
// being shut down as idle in the middle of a sync.
async function writeState(via: SyncVia, stage: SyncState['stage'], progress?: SnapshotProgress) {
  currentStage = stage
  courseCount = progress?.courseCount ?? courseCount
  const state: SyncState = { running: true, startedAt, updatedAt: Date.now(), via, stage, progress, courseCount }
  await chrome.storage.session.set({ [STORAGE.syncState]: state })
}

async function findBlackboardTab(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ url: `${BB_ORIGIN}/*` })
  return tabs.find((tab) => tab.id != null)?.id
}

async function checkSession(): Promise<SessionCheck> {
  let result: SessionCheck
  try {
    const me = await getMe(browserFetch)
    result = { status: 'connected', via: 'worker', userName: me.userName }
  } catch (err) {
    if (!(err instanceof BbLoginRequiredError)) {
      result = { status: 'error', error: errorMessage(err) }
    } else {
      result = { status: 'login', reason: err.message }
      const tabId = await findBlackboardTab()
      if (tabId != null) {
        try {
          const reply = await chrome.tabs.sendMessage<ContentMessage, ContentCheckReply>(tabId, { type: 'bb-check' })
          if (reply?.ok) result = { status: 'connected', via: 'tab', userName: reply.userName }
          else if (reply && !reply.loginRequired) result = { status: 'error', error: reply.error }
        } catch {
          // That tab has no content script (opened before the extension loaded).
        }
      }
    }
  }
  await saveSession(result)
  return result
}

async function saveSession(result: SessionCheck) {
  await chrome.storage.session.set({ [STORAGE.session]: result })
  if (result.status === 'login') await setBadge('!', '#D97757')
  else if (result.status === 'connected') await setBadge('', '#D97757')
}

async function runSync(): Promise<LastRun> {
  startedAt = new Date().toISOString()
  courseCount = undefined
  await writeState('worker', 'session')
  await setBadge('…', '#6B6A66')
  let workerError: string
  try {
    const snap = await snapshot(browserFetch, { onProgress: (p) => void writeState('worker', p.stage, p) })
    return await finish(snap, 'worker')
  } catch (err) {
    if (!(err instanceof BbLoginRequiredError)) return fail(err, false)
    // The worker's requests may lack the session cookie (SameSite rules), so
    // try an open Blackboard tab before calling it logged out.
    workerError = err.message
  }

  const tabId = await findBlackboardTab()
  if (tabId == null) return fail(new Error('Blackboard needs you to log in.'), true)
  await writeState('tab', 'session')
  let reply: ContentReply | undefined
  try {
    reply = await chrome.tabs.sendMessage<ContentMessage, ContentReply>(tabId, { type: 'bb-snapshot' })
  } catch {
    return fail(new Error('Reload your Blackboard tab, then sync again.'), false)
  }
  if (!reply) return fail(new Error('The Blackboard tab did not answer. Reload it and sync again.'), false)
  if (!reply.ok) return fail(new Error(reply.loginRequired ? 'Blackboard needs you to log in.' : reply.error), reply.loginRequired)
  return finish(reply.snapshot, 'tab', workerError)
}

async function finish(snap: BbSnapshot, via: SyncVia, workerError?: string): Promise<LastRun> {
  await writeState(via, 'saving')
  await chrome.storage.local.set({ [STORAGE.lastSnapshot]: snap })
  const upload = await sendToDashboard(snap)
  const run: LastRun = { at: new Date().toISOString(), ok: true, via, summary: summariseSnapshot(snap), workerError, upload }
  await chrome.storage.local.set({ [STORAGE.lastRun]: run, [STORAGE.lastSummary]: run.summary })
  await chrome.storage.session.remove(STORAGE.syncState)
  await saveSession({ status: 'connected', via, userName: snap.user.userName })
  if (upload && !upload.ok) await setBadge('?', '#6B6A66')
  return run
}

/** POSTs the snapshot to the dashboard. Undefined when no dashboard is set up. */
async function sendToDashboard(snap: BbSnapshot): Promise<UploadResult | undefined> {
  const stored = await chrome.storage.local.get(STORAGE.dashboard)
  const dashboard = stored[STORAGE.dashboard] as DashboardConfig | undefined
  if (!dashboard?.url || !dashboard.token) return undefined
  let res: Response
  try {
    res = await fetch(`${dashboard.url}${SYNC_PATH}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dashboard.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual', snapshot: snap }),
    })
  } catch (err) {
    return { ok: false, error: `Couldn't reach the dashboard (${errorMessage(err)}).` }
  }
  const body = (await res.json().catch(() => null)) as { counts?: Record<string, unknown>; detail?: string } | null
  if (res.ok && body?.counts) return { ok: true, counts: body.counts }
  if (res.status === 401) return { ok: false, error: 'The dashboard rejected the sync token.' }
  return { ok: false, error: `The dashboard returned ${res.status}${body?.detail ? `: ${body.detail}` : ''}.` }
}

async function fail(err: unknown, loginRequired: boolean): Promise<LastRun> {
  const run: LastRun = {
    at: new Date().toISOString(),
    ok: false,
    loginRequired,
    error: errorMessage(err),
    stage: currentStage,
  }
  await chrome.storage.local.set({ [STORAGE.lastRun]: run })
  await chrome.storage.session.remove(STORAGE.syncState)
  if (loginRequired) await saveSession({ status: 'login', reason: run.error })
  else await setBadge('?', '#6B6A66')
  return run
}

async function setBadge(text: string, color: string) {
  await chrome.action.setBadgeText({ text })
  await chrome.action.setBadgeBackgroundColor({ color })
}
