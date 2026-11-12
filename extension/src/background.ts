// Service worker. A sync takes a raw snapshot, stores it locally, reports
// progress for the side panel, POSTs the finished snapshot to the dashboard
// (/api/blackboard/sync) when one is set up, then reads the text of the
// handbooks and briefs the dashboard asks for. A snapshot that failed
// part-way is never sent.
//
// Three triggers: Sync now (manual), a daily alarm, and visiting Blackboard
// (the content script says so once per page load). Rules: triggers.ts.
import {
  BB_ORIGIN,
  BbLoginRequiredError,
  getMe,
  snapshot,
  summariseSnapshot,
  type BbFetch,
  type BbSnapshot,
  type SnapshotProgress,
} from '@/lib/blackboard/client'
import { docxToText } from '@/lib/blackboard/docx-text'
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_PATH,
  type DocumentResponse,
  type SyncResponse,
  type WantedDocument,
} from '@/lib/blackboard/wire'
import { readDocuments, type DocumentsResult } from './documents'
import { downloadLimited } from './download'
import { pdfToText } from './pdf-text'
import {
  STORAGE,
  SYNC_PATH,
  SYNC_STALE_MS,
  browserFetch,
  errorMessage,
  type ContentCheckReply,
  type ContentMessage,
  type ContentReply,
  type DashboardConfig,
  type LastAutoRun,
  type LastRun,
  type SessionCheck,
  type SyncState,
  type SyncVia,
  type UploadResult,
  type WorkerMessage,
} from './shared'
import {
  DAILY_ALARM,
  DAILY_PERIOD_MINUTES,
  firstDailyAlarmAt,
  isSyncLocked,
  shouldRunDaily,
  shouldRunVisit,
  type SyncTrigger,
  type TriggerClock,
} from './triggers'
import { postToDashboard } from './upload'

/** Same pause as the snapshot's, between document requests to Blackboard. */
const DOCUMENT_DELAY_MS = 150

/** Plain fetch, called unbound-safe. Used for the dashboard POSTs and file downloads (GET). */
const workerFetch = (url: string, init: RequestInit) => fetch(url, init)

// Clicking the toolbar icon opens the side panel, which stays open across tabs.
const openPanelOnClick = () => void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
chrome.runtime.onInstalled.addListener(() => {
  openPanelOnClick()
  void ensureDailyAlarm()
})
chrome.runtime.onStartup.addListener(() => {
  openPanelOnClick()
  void ensureDailyAlarm()
})
// Also on every worker start: Chrome can drop alarms (updates, restarts).
void ensureDailyAlarm()

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM) void startSync('daily')
})

let running: Promise<LastRun | undefined> | null = null
let startedAt = ''
let currentTrigger: SyncTrigger = 'manual'
let currentStage: SyncState['stage'] = 'session'
let courseCount: number | undefined

chrome.runtime.onMessage.addListener((message: WorkerMessage, sender, sendResponse) => {
  switch (message?.type) {
    case 'sync':
      void startSync('manual').then(sendResponse)
      return true // reply asynchronously
    case 'visit':
      if (sender.tab) void startSync('visit')
      return
    case 'check':
      void checkSession().then(sendResponse)
      return true
    case 'progress':
      if (sender.tab && running) void writeState('tab', message.progress.stage, message.progress)
      return
  }
})

async function ensureDailyAlarm() {
  if (await chrome.alarms.get(DAILY_ALARM)) return
  const clock = await readClock()
  await chrome.alarms.create(DAILY_ALARM, { when: firstDailyAlarmAt(clock, Date.now()), periodInMinutes: DAILY_PERIOD_MINUTES })
}

async function readClock(): Promise<TriggerClock> {
  const stored = await chrome.storage.local.get([STORAGE.syncStartedAt, STORAGE.lastAttemptAt, STORAGE.lastSuccessAt])
  return {
    syncStartedAt: stored[STORAGE.syncStartedAt] as number | undefined,
    lastAttemptAt: stored[STORAGE.lastAttemptAt] as number | undefined,
    lastSuccessAt: stored[STORAGE.lastSuccessAt] as number | undefined,
  }
}

/**
 * Starts a sync unless one is running or the trigger's rule says not yet.
 * Resolves to the run, or undefined when nothing was started. Never two at
 * once: `running` guards this worker, `syncStartedAt` (10-minute timeout)
 * guards across a worker restart.
 */
function startSync(trigger: SyncTrigger): Promise<LastRun | undefined> {
  if (running) return trigger === 'manual' ? running : Promise.resolve(undefined)
  running = (async () => {
    const now = Date.now()
    const clock = await readClock()
    if (isSyncLocked(clock, now) && !(trigger === 'manual' && (await lockIsAbandoned()))) return undefined
    if (trigger === 'daily' && !shouldRunDaily(clock, now)) return undefined
    if (trigger === 'visit' && !shouldRunVisit(clock, now)) return undefined
    await chrome.storage.local.set({ [STORAGE.syncStartedAt]: now, [STORAGE.lastAttemptAt]: now })
    try {
      const run = await runSync(trigger)
      if (trigger !== 'manual') await recordAutoRun(trigger, run)
      return run
    } finally {
      await chrome.storage.local.remove(STORAGE.syncStartedAt)
    }
  })().finally(() => {
    running = null
  })
  return running
}

/**
 * A lock with no progress for a minute belongs to a worker that was stopped
 * mid-sync. Sync now may then take over (the panel shows it as not running);
 * automatic triggers still wait out the 10 minutes.
 */
async function lockIsAbandoned(): Promise<boolean> {
  const stored = await chrome.storage.session.get(STORAGE.syncState)
  const state = stored[STORAGE.syncState] as SyncState | undefined
  return !state || Date.now() - state.updatedAt >= SYNC_STALE_MS
}

async function recordAutoRun(trigger: Exclude<SyncTrigger, 'manual'>, run: LastRun) {
  const outcome: LastAutoRun['outcome'] = !run.ok
    ? run.loginRequired
      ? 'login'
      : 'error'
    : !run.upload
      ? 'read'
      : run.upload.ok
        ? 'saved'
        : 'not-saved'
  await chrome.storage.local.set({ [STORAGE.lastAutoRun]: { at: run.at, trigger, outcome } satisfies LastAutoRun })
}

// Every write is an extension API call, which also stops the worker from
// being shut down as idle in the middle of a sync.
async function writeState(
  via: SyncVia,
  stage: SyncState['stage'],
  progress?: SnapshotProgress,
  documents?: SyncState['documents'],
) {
  currentStage = stage
  courseCount = progress?.courseCount ?? courseCount
  const state: SyncState = {
    running: true,
    trigger: currentTrigger,
    startedAt,
    updatedAt: Date.now(),
    via,
    stage,
    progress,
    courseCount,
    documents,
  }
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

async function runSync(trigger: SyncTrigger): Promise<LastRun> {
  startedAt = new Date().toISOString()
  currentTrigger = trigger
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

  // Logged out with no Blackboard tab: automatic runs end here, silently
  // (the `!` badge), and wait for the next trigger.
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
  const dashboard = await readDashboard()
  const sent = dashboard ? await sendSnapshot(dashboard, snap) : undefined
  let documents: DocumentsResult | undefined
  if (dashboard && sent?.upload.ok && sent.wanted.length > 0) {
    documents = await syncDocuments(dashboard, snap, sent.wanted, via)
  }
  const run: LastRun = {
    at: new Date().toISOString(),
    ok: true,
    trigger: currentTrigger,
    via,
    summary: summariseSnapshot(snap),
    workerError,
    upload: sent?.upload,
    documents,
  }
  const saved = !sent || sent.upload.ok
  await chrome.storage.local.set({
    [STORAGE.lastRun]: run,
    [STORAGE.lastSummary]: run.summary,
    ...(saved ? { [STORAGE.lastSuccessAt]: Date.now() } : {}),
  })
  await chrome.storage.session.remove(STORAGE.syncState)
  await saveSession({ status: 'connected', via, userName: snap.user.userName })
  if (!saved) await setBadge('?', '#6B6A66')
  return run
}

async function readDashboard(): Promise<DashboardConfig | undefined> {
  const stored = await chrome.storage.local.get(STORAGE.dashboard)
  const dashboard = stored[STORAGE.dashboard] as DashboardConfig | undefined
  return dashboard?.url && dashboard.token ? dashboard : undefined
}

const isSyncResponse = (body: unknown): body is SyncResponse =>
  !!body && typeof body === 'object' && !!(body as SyncResponse).counts && typeof (body as SyncResponse).counts === 'object'

const isDocumentResponse = (body: unknown): body is DocumentResponse =>
  !!body && typeof body === 'object' && (body as DocumentResponse).ok === true

/** POSTs the snapshot (gzipped when possible) with the real trigger. */
async function sendSnapshot(
  dashboard: DashboardConfig,
  snap: BbSnapshot,
): Promise<{ upload: UploadResult; wanted: WantedDocument[] }> {
  const res = await postToDashboard(workerFetch, `${dashboard.url}${SYNC_PATH}`, dashboard.token, { trigger: currentTrigger, snapshot: snap }, {
    accept: isSyncResponse,
    tooLarge: 'Snapshot too large for the dashboard',
  })
  if (!res.ok) return { upload: { ok: false, error: res.error, bytes: res.bytes }, wanted: [] }
  const wanted = Array.isArray(res.body.wanted) ? res.body.wanted : []
  return { upload: { ok: true, counts: res.body.counts, bytes: res.bytes }, wanted }
}

/** Reads the wanted handbooks / briefs from the worker (downloads can't go through a tab). */
async function syncDocuments(
  dashboard: DashboardConfig,
  snap: BbSnapshot,
  wanted: WantedDocument[],
  via: SyncVia,
): Promise<DocumentsResult> {
  let requests = 0
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const pause = async () => {
    if (requests++ > 0) await sleep(DOCUMENT_DELAY_MS)
  }
  const bbFetch: BbFetch = async (url) => {
    await pause()
    return browserFetch(url)
  }
  await writeState(via, 'documents', undefined, { done: 0, total: wanted.length })
  return readDocuments(snap, wanted, {
    bbFetch,
    pause,
    download: (url) => downloadLimited(workerFetch, url, DOCUMENT_MAX_BYTES),
    extract: async (kind, bytes) => (kind === 'pdf' ? pdfToText(bytes) : { text: await docxToText(bytes), pageCount: null }),
    upload: async (doc) => {
      const res = await postToDashboard(workerFetch, `${dashboard.url}${DOCUMENT_PATH}`, dashboard.token, doc, {
        accept: isDocumentResponse,
        tooLarge: 'Document text too large for the dashboard',
      })
      return res.ok ? { ok: true } : { ok: false, error: res.error, fatal: res.fatal }
    },
    onProgress: (done, total) => void writeState(via, 'documents', undefined, { done, total }),
  })
}

async function fail(err: unknown, loginRequired: boolean): Promise<LastRun> {
  const run: LastRun = {
    at: new Date().toISOString(),
    ok: false,
    trigger: currentTrigger,
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
