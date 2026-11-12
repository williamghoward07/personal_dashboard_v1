// Side panel. Stays open while you switch tabs, and rebuilds itself from
// chrome.storage whenever it opens, so a sync already running in the worker
// shows up as running. Each function appears once: one Sync button, one
// progress bar, one course list.
import { BB_ORIGIN, courseOutlineUrl, type SnapshotSummary } from '@/lib/blackboard/client'
import { icon } from './icons'
import {
  STORAGE,
  SYNC_STALE_MS,
  dashboardOrigin,
  type DashboardConfig,
  type LastRun,
  type SessionCheck,
  type SyncState,
  type WorkerMessage,
} from './shared'

type Tab = 'overview' | 'courses'
type CourseRow = SnapshotSummary['courses'][number]

const state: {
  tab: Tab
  lastRun?: LastRun
  /** Last successful sync, kept when a later run fails. */
  lastSummary?: SnapshotSummary
  sync?: SyncState
  session?: SessionCheck
  dashboard?: DashboardConfig
  /** The dashboard form: open when nothing is set up yet, or after Change. */
  editingDashboard: boolean
  draft: { url: string; token: string }
  dashboardError?: string
} = { tab: 'overview', editingDashboard: false, draft: { url: '', token: '' } }

// ---------- tiny DOM helper ----------

type Child = Node | string | number | null | undefined | false
type Props = Record<string, string | boolean | ((event: Event) => void) | undefined>

function h(tag: string, props: Props = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue
    if (typeof value === 'function') el.addEventListener(key.replace(/^on/, '').toLowerCase(), value)
    else if (value === true) el.setAttribute(key, '')
    else if (key === 'class') el.className = value
    else el.setAttribute(key, value)
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    el.append(typeof child === 'object' ? child : String(child))
  }
  return el
}

// ---------- derived state ----------

const STAGES: SyncState['stage'][] = ['session', 'courses', 'content', 'todo', 'saving']

function activeSync(): SyncState | undefined {
  const sync = state.sync
  return sync && Date.now() - sync.updatedAt < SYNC_STALE_MS ? sync : undefined
}

/** The last good data, even when the latest run failed. */
function summary(): SnapshotSummary | undefined {
  return state.lastRun?.ok ? state.lastRun.summary : state.lastSummary
}

/** What the single line under the progress bar says while syncing. */
function stepText(sync: SyncState): string {
  const p = sync.progress
  switch (sync.stage) {
    case 'session':
      return 'Checking your login'
    case 'courses':
      return 'Finding your courses'
    case 'content':
      return p?.stage === 'content' ? `Reading ${shortCode(p.courseCode ?? '')} (${p.courseIndex} of ${p.courseCount})` : 'Reading your courses'
    case 'todo':
      return p?.stage === 'todo' ? `Reading due dates (${p.windowIndex} of ${p.windowCount})` : 'Reading due dates'
    case 'saving':
      return 'Saving'
  }
}

function shortCode(courseCode: string): string {
  return courseCode.replace(/^X_/, '').replace(/_\d{4}$/, '').replaceAll('_', ' ')
}

function courseLabel(c: CourseRow): string {
  return c.moduleCode ?? shortCode(c.courseCode)
}

function relativeTime(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === today.toDateString()) return `Today ${time}`
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` ${time}`
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// ---------- actions ----------

function startSync() {
  if (activeSync()) return
  // Optimistic: the worker writes the real state a moment later.
  state.sync = { running: true, startedAt: new Date().toISOString(), updatedAt: Date.now(), via: 'worker', stage: 'session' }
  render()
  void chrome.runtime.sendMessage<WorkerMessage, LastRun>({ type: 'sync' }).then((run) => {
    state.lastRun = run
    state.sync = undefined
    render()
  })
}

function openUrl(url: string) {
  void chrome.tabs.create({ url })
}

function saveDashboard() {
  const origin = dashboardOrigin(state.draft.url)
  // Blank while changing an existing setup keeps the saved token.
  const token = state.draft.token.trim() || state.dashboard?.token || ''
  state.dashboardError = !origin
    ? 'Enter the dashboard address, starting https://'
    : !token
      ? 'Paste the sync token (BLACKBOARD_SYNC_TOKEN).'
      : undefined
  if (!origin || !token) return render()
  // Must run straight from the click: Chrome only asks inside a user gesture.
  void chrome.permissions.request({ origins: [`${origin}/*`] }).then(async (granted) => {
    if (!granted) {
      state.dashboardError = `Chrome needs permission to send syncs to ${new URL(origin).host}.`
      return render()
    }
    state.editingDashboard = false
    state.dashboardError = undefined
    await chrome.storage.local.set({ [STORAGE.dashboard]: { url: origin, token } satisfies DashboardConfig })
  })
}

async function downloadSnapshot() {
  const stored = await chrome.storage.local.get(STORAGE.lastSnapshot)
  const snap = stored[STORAGE.lastSnapshot]
  if (!snap) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }))
  const a = h('a', { href: url, download: `blackboard-sync-${new Date().toISOString().slice(0, 10)}.json` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- views ----------

function header(): HTMLElement {
  const session = state.session
  let on = false
  let text = 'Checking Blackboard…'
  if (activeSync() || session?.status === 'connected') {
    on = true
    text = 'Blackboard connected'
  } else if (session?.status === 'login') text = 'Not logged in'
  else if (session?.status === 'error') text = 'Blackboard unreachable'
  return h(
    'header',
    { class: 'header' },
    h('div', { class: 'brand' }, 'Blackboard Sync'),
    h('div', { class: 'status' }, h('span', { class: `status-dot${on ? ' on' : ''}` }), text),
  )
}

function tabs(): HTMLElement {
  const tab = (id: Tab, label: string) =>
    h(
      'button',
      {
        class: `tab${state.tab === id ? ' active' : ''}`,
        role: 'tab',
        'aria-selected': state.tab === id ? 'true' : 'false',
        onclick: () => {
          state.tab = id
          render()
        },
      },
      label,
    )
  return h('nav', { class: 'tabs', role: 'tablist' }, tab('overview', 'Overview'), tab('courses', 'Courses'))
}

/** The one progress indicator: five circles joined by a line. */
function progressBar(at: number, mode: 'current' | 'error'): HTMLElement {
  const bar = h('div', { class: 'roadmap', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(STAGES.length), 'aria-valuenow': String(at) })
  STAGES.forEach((_, i) => {
    const status = i < at ? 'done' : i === at ? mode : 'todo'
    if (i > 0) bar.append(h('span', { class: `line${i <= at ? ' done' : ''}` }))
    bar.append(
      h(
        'span',
        { class: `circle ${status}` },
        status === 'done' ? icon('check', 13, 3.5) : null,
        status === 'error' ? h('strong', { class: 'bang' }, '!') : null,
      ),
    )
  })
  return bar
}

function row(label: string, value: string): HTMLElement {
  return h('div', { class: 'row' }, h('span', { class: 'row-label' }, label), h('span', { class: 'row-value' }, value))
}

function overview(): HTMLElement[] {
  const sync = activeSync()
  const run = state.lastRun
  const s = summary()
  const failed = !sync && run && !run.ok ? run : undefined

  let progress: HTMLElement | null = null
  if (sync) {
    const at = STAGES.indexOf(sync.stage)
    progress = h('div', { class: 'progress' }, progressBar(at, 'current'), h('div', { class: 'step-text' }, `Step ${at + 1} of ${STAGES.length} · ${stepText(sync)}`))
  } else if (failed) {
    const at = Math.max(0, STAGES.indexOf(failed.stage ?? 'session'))
    progress = h(
      'div',
      { class: 'progress' },
      progressBar(at, 'error'),
      h('div', { class: 'step-text error-text' }, failed.error),
      failed.loginRequired
        ? h('button', { class: 'secondary', onclick: () => openUrl(`${BB_ORIGIN}/ultra/course`) }, icon('externalLink', 15), 'Open Blackboard to log in')
        : null,
    )
  }

  const via = run?.ok ? run.via : undefined
  return [
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Sync Blackboard'),
      h('p', {}, 'Reads your courses, due dates, grades, announcements and course content. Read-only: nothing on Blackboard changes.'),
      progress,
      h(
        'div',
        { class: 'rows' },
        row('Last sync', run ? `${relativeTime(run.at)}${run.ok ? '' : ', failed'}` : 'Never'),
        s ? row('Found', `${plural(s.courses.length, 'course')} · ${s.todoItems} due · ${s.courses.reduce((n, c) => n + c.contents, 0)} items`) : null,
        row('Dashboard', uploadText()),
      ),
      run?.ok && run.upload && !run.upload.ok ? h('div', { class: 'step-text error-text' }, run.upload.error) : null,
      h('button', { class: 'primary', disabled: !!sync, onclick: startSync }, sync ? 'Syncing…' : 'Sync now'),
      s || via
        ? h(
            'div',
            { class: 'note' },
            // Phase 1 diagnostic: did the background worker reach Blackboard itself?
            via ? h('span', {}, via === 'tab' ? 'Read through your open Blackboard tab' : 'Read in the background') : h('span'),
            s ? h('button', { class: 'link', onclick: () => void downloadSnapshot() }, icon('download', 14), 'Download JSON') : null,
          )
        : null,
    ),
    dashboardCard(),
  ]
}

function uploadText(): string {
  if (!state.dashboard) return 'Not set up'
  const run = state.lastRun
  if (!run?.ok || !run.upload) return 'Not sent yet'
  return run.upload.ok ? 'Saved' : 'Not saved'
}

/** Where syncs are sent: the URL and token, entered once. */
function dashboardCard(): HTMLElement {
  const dashboard = state.dashboard
  if (dashboard && !state.editingDashboard) {
    return h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Dashboard'),
      h(
        'div',
        { class: 'course-meta' },
        h('span', {}, `Syncs go to ${new URL(dashboard.url).host}`),
        h(
          'button',
          {
            class: 'text-button',
            onclick: () => {
              state.editingDashboard = true
              state.draft = { url: dashboard.url, token: '' }
              render()
            },
          },
          'Change',
        ),
      ),
    )
  }
  const field = (label: string, key: 'url' | 'token', props: Record<string, string>) =>
    h(
      'label',
      { class: 'field' },
      h('span', { class: 'row-label' }, label),
      h('input', {
        ...props,
        value: state.draft[key],
        spellcheck: 'false',
        autocomplete: 'off',
        oninput: (event: Event) => {
          state.draft[key] = (event.target as HTMLInputElement).value
        },
      }),
    )
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, 'Dashboard'),
    h('p', {}, 'Each sync is sent to Study Copilot. Enter its address and the sync token once.'),
    field('Address', 'url', { type: 'url', placeholder: 'https://…' }),
    field('Sync token', 'token', { type: 'password', placeholder: dashboard ? 'Unchanged' : '' }),
    state.dashboardError ? h('div', { class: 'step-text error-text' }, state.dashboardError) : null,
    h('button', { class: 'secondary', onclick: saveDashboard }, 'Save'),
    dashboard
      ? h(
          'button',
          {
            class: 'link cancel',
            onclick: () => {
              state.editingDashboard = false
              state.dashboardError = undefined
              render()
            },
          },
          'Cancel',
        )
      : null,
  )
}

function courses(): HTMLElement[] {
  const list = [...(summary()?.courses ?? [])].sort(
    // Modules first (they map to workspaces), then org courses.
    (a, b) => Number(!a.moduleCode) - Number(!b.moduleCode) || courseLabel(a).localeCompare(courseLabel(b)),
  )
  if (list.length === 0) return [h('div', { class: 'empty' }, 'No courses yet. Sync to pull them in.')]
  const card = (c: CourseRow) =>
    h(
      'section',
      { class: 'card' },
      h('h2', {}, c.name),
      h('p', {}, `${courseLabel(c)} · ${plural(c.announcements, 'announcement')} · ${plural(c.contents, 'item')}`),
      h(
        'div',
        { class: 'course-meta' },
        c.errors ? h('span', { class: 'error-text' }, plural(c.errors, 'problem')) : h('span', {}, `${plural(c.grades, 'grade')} released`),
        h('button', { class: 'text-button', onclick: () => openUrl(courseOutlineUrl(c.bbId)) }, 'Open'),
      ),
    )
  const other = list.filter((c) => !c.moduleCode)
  return [
    ...list.filter((c) => c.moduleCode).map(card),
    other.length ? h('div', { class: 'group-label' }, 'Other courses') : null,
    ...other.map(card),
  ].filter((el): el is HTMLElement => el !== null)
}

// ---------- render ----------

const app = document.getElementById('app')!

function render() {
  app.replaceChildren(header(), tabs(), h('main', { class: 'content', role: 'tabpanel' }, ...(state.tab === 'overview' ? overview() : courses())))
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && STORAGE.syncState in changes) state.sync = changes[STORAGE.syncState].newValue as SyncState | undefined
  if (area === 'session' && STORAGE.session in changes) state.session = changes[STORAGE.session].newValue as SessionCheck | undefined
  if (area === 'local' && STORAGE.lastRun in changes) state.lastRun = changes[STORAGE.lastRun].newValue as LastRun | undefined
  if (area === 'local' && STORAGE.dashboard in changes)
    state.dashboard = changes[STORAGE.dashboard].newValue as DashboardConfig | undefined
  if (area === 'local' && STORAGE.lastSummary in changes)
    state.lastSummary = changes[STORAGE.lastSummary].newValue as SnapshotSummary | undefined
  render()
})

async function init() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([STORAGE.lastRun, STORAGE.lastSummary, STORAGE.dashboard]),
    chrome.storage.session.get([STORAGE.syncState, STORAGE.session]),
  ])
  state.lastRun = local[STORAGE.lastRun] as LastRun | undefined
  // Installs from before lastSummary existed still have it inside lastRun.
  const last = state.lastRun
  state.lastSummary = (local[STORAGE.lastSummary] as SnapshotSummary | undefined) ?? (last?.ok ? last.summary : undefined)
  state.dashboard = local[STORAGE.dashboard] as DashboardConfig | undefined
  state.sync = session[STORAGE.syncState] as SyncState | undefined
  state.session = session[STORAGE.session] as SessionCheck | undefined
  render()
  // Fresh "connected" check each time the panel opens (one request).
  if (!activeSync()) void chrome.runtime.sendMessage<WorkerMessage, SessionCheck>({ type: 'check' })
}

void init()
