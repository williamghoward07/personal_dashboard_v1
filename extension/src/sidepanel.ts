// Side panel. Stays open while you switch tabs, and rebuilds itself from
// chrome.storage whenever it opens, so a sync already running in the worker
// shows up as running.
import { BB_ORIGIN, type SnapshotSummary } from '@/lib/blackboard/client'
import { icon } from './icons'
import { STORAGE, SYNC_STALE_MS, type LastRun, type SessionCheck, type SyncState, type WorkerMessage } from './shared'

type Tab = 'overview' | 'courses' | 'running'
type Theme = 'light' | 'dark'
type CourseRow = SnapshotSummary['courses'][number]

const state: {
  tab: Tab
  selected: string | null
  lastRun?: LastRun
  /** Last successful sync, kept when a later run fails. */
  lastSummary?: SnapshotSummary
  sync?: SyncState
  session?: SessionCheck
  theme?: Theme
} = { tab: 'overview', selected: null }

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

const STEPS: { stage: SyncState['stage']; name: string }[] = [
  { stage: 'session', name: 'Check your login' },
  { stage: 'courses', name: 'Find your courses' },
  { stage: 'content', name: 'Read each course' },
  { stage: 'todo', name: 'Read due dates' },
  { stage: 'saving', name: 'Save on this computer' },
]

function activeSync(): SyncState | undefined {
  const sync = state.sync
  return sync && Date.now() - sync.updatedAt < SYNC_STALE_MS ? sync : undefined
}

/** The last good data, even when the latest run failed. */
function summary(): SnapshotSummary | undefined {
  return state.lastRun?.ok ? state.lastRun.summary : state.lastSummary
}

type StepStatus = 'done' | 'current' | 'todo' | 'error'

function stepStatuses(): StepStatus[] | null {
  const sync = activeSync()
  const run = state.lastRun
  let at: number
  let mode: 'current' | 'error' | 'done'
  if (sync) {
    at = STEPS.findIndex((s) => s.stage === sync.stage)
    mode = 'current'
  } else if (run && !run.ok) {
    at = Math.max(0, STEPS.findIndex((s) => s.stage === run.stage))
    mode = 'error'
  } else if (run?.ok) {
    return STEPS.map(() => 'done')
  } else {
    return null
  }
  return STEPS.map((_, i) => (i < at ? 'done' : i === at ? mode : 'todo'))
}

function stepDetail(index: number, status: StepStatus): string {
  const sync = activeSync()
  const run = state.lastRun
  const s = summary()
  const p = sync?.progress
  if (status === 'error' && run && !run.ok) return run.error
  switch (STEPS[index].stage) {
    case 'session':
      return status === 'done' ? (sync?.via ?? (run?.ok ? run.via : 'worker')) === 'tab' ? 'Through your open Blackboard tab' : 'Using your Blackboard login' : 'Checking Blackboard'
    case 'courses': {
      const count = sync?.courseCount ?? s?.courses.length
      return status === 'done' && count != null ? `${count} courses` : status === 'current' ? 'Listing this year’s courses' : 'Courses you’re enrolled on'
    }
    case 'content':
      if (status === 'current' && p?.stage === 'content') return `${shortCode(p.courseCode ?? '')} · ${p.courseIndex} of ${p.courseCount}`
      if (status === 'done' && s) return `${s.courses.reduce((n, c) => n + c.contents, 0)} items, ${s.courses.reduce((n, c) => n + c.announcements, 0)} announcements`
      return status === 'done' ? 'Done' : 'Content, announcements and grades'
    case 'todo':
      if (status === 'current' && p?.stage === 'todo') return `Part ${p.windowIndex} of ${p.windowCount}`
      return status === 'done' && s ? `${s.todoItems} due in the next 12 weeks` : 'Coursework deadlines'
    case 'saving':
      return status === 'done' ? 'Kept in this browser. Not sent anywhere yet' : 'Kept in this browser'
  }
}

function shortCode(courseCode: string): string {
  return courseCode.replace(/^X_/, '').replace(/_\d{4}$/, '').replaceAll('_', ' ')
}

function courseLabel(c: CourseRow): string {
  return c.moduleCode ?? shortCode(c.courseCode)
}

function courseUrl(c: CourseRow): string {
  return `${BB_ORIGIN}/ultra/courses/${encodeURIComponent(c.bbId)}/outline`
}

function sortedCourses(): CourseRow[] {
  const courses = summary()?.courses ?? []
  // Modules first (they map to workspaces), then org courses.
  return [...courses].sort((a, b) => Number(!a.moduleCode) - Number(!b.moduleCode) || courseLabel(a).localeCompare(courseLabel(b)))
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
  state.tab = 'running'
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

async function downloadSnapshot() {
  const stored = await chrome.storage.local.get(STORAGE.lastSnapshot)
  const snap = stored[STORAGE.lastSnapshot]
  if (!snap) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }))
  const a = h('a', { href: url, download: `blackboard-sync-${new Date().toISOString().slice(0, 10)}.json` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function effectiveTheme(): Theme {
  return state.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

function toggleTheme() {
  state.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'
  void chrome.storage.local.set({ [STORAGE.theme]: state.theme })
  render()
}

// ---------- views ----------

function header(): HTMLElement {
  const session = state.session
  const sync = activeSync()
  let dotOn = false
  let text = 'Checking Blackboard…'
  if (sync) {
    dotOn = true
    text = 'Syncing…'
  } else if (session?.status === 'connected') {
    dotOn = true
    text = 'Blackboard connected'
  } else if (session?.status === 'login') text = 'Not logged in'
  else if (session?.status === 'error') text = 'Blackboard unreachable'
  const theme = effectiveTheme()
  return h(
    'header',
    { class: 'header' },
    h('div', { class: 'brand' }, 'Blackboard Sync'),
    h(
      'div',
      { class: 'header-right' },
      h('div', { class: 'status', title: session?.status === 'login' ? session.reason : '' }, h('span', { class: `status-dot${dotOn ? ' on' : ''}` }), text),
      h(
        'button',
        { class: 'icon-button', title: theme === 'dark' ? 'Light mode' : 'Dark mode', 'aria-label': 'Toggle light or dark mode', onclick: toggleTheme },
        icon(theme === 'dark' ? 'sun' : 'moon', 16),
      ),
    ),
  )
}

function strip(): HTMLElement {
  const sync = activeSync()
  const courses = sortedCourses()
  const chips = h(
    'div',
    {
      class: 'chips',
      // Mouse wheels scroll the strip sideways.
      onwheel: (event: Event) => {
        const wheel = event as WheelEvent
        if (Math.abs(wheel.deltaY) > Math.abs(wheel.deltaX)) {
          ;(wheel.currentTarget as HTMLElement).scrollLeft += wheel.deltaY
          wheel.preventDefault()
        }
      },
    },
    ...(courses.length
      ? courses.map((c) =>
          h(
            'button',
            {
              class: `chip${state.selected === c.bbId ? ' selected' : ''}`,
              title: c.name,
              'aria-label': `${courseLabel(c)}, ${c.name}`,
              'aria-pressed': state.selected === c.bbId ? 'true' : 'false',
              onclick: () => {
                state.selected = state.selected === c.bbId ? null : c.bbId
                render()
              },
            },
            icon('bookOpen', 16, 1.75),
            courseLabel(c),
          ),
        )
      : [h('span', { class: 'chips-empty' }, 'Your courses appear here after a sync')]),
  )
  return h(
    'div',
    { class: 'strip' },
    h(
      'button',
      { class: `round${sync ? ' spinning' : ''}`, title: sync ? 'Syncing…' : 'Sync now', 'aria-label': 'Sync now', disabled: !!sync, onclick: startSync },
      icon('refresh', 16),
    ),
    chips,
  )
}

function detailCard(): HTMLElement | null {
  const c = sortedCourses().find((course) => course.bbId === state.selected)
  if (!c) return null
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, c.name),
    h('p', {}, c.moduleCode ? `${c.moduleCode} · module, links to its workspace` : `${shortCode(c.courseCode)} · not a module`),
    h(
      'div',
      { class: 'rows' },
      row('Announcements', c.announcements),
      row('Content items', c.skippedFolders ? `${c.contents}+` : c.contents),
      row('Gradebook', `${plural(c.columns, 'column')} · ${plural(c.grades, 'grade')}`),
      c.errors ? row('Problems', c.errors, 'alert') : null,
    ),
    h('button', { class: 'secondary', onclick: () => openUrl(courseUrl(c)) }, icon('externalLink', 15), 'Open in Blackboard'),
  )
}

function row(label: string, value: string | number, mark?: 'tick' | 'alert'): HTMLElement {
  return h(
    'div',
    { class: 'row' },
    h('span', { class: 'row-label' }, label),
    h(
      'span',
      { class: 'row-value' },
      String(value),
      mark === 'tick' ? h('span', { class: 'tick' }, icon('check', 11, 3.5)) : null,
      mark === 'alert' ? h('span', { class: 'alert' }, icon('alert', 18)) : null,
    ),
  )
}

function tabs(): HTMLElement {
  const sync = activeSync()
  const tab = (id: Tab, label: string, dot = false) =>
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
      dot ? h('span', { class: 'tab-dot', 'aria-label': 'running' }) : null,
    )
  return h('nav', { class: 'tabs', role: 'tablist' }, tab('overview', 'Overview'), tab('courses', 'Courses'), tab('running', 'Running now', !!sync))
}

function banner(): HTMLElement | null {
  if (state.tab === 'running') return null
  const sync = activeSync()
  if (sync) {
    const at = STEPS.findIndex((s) => s.stage === sync.stage)
    return h(
      'button',
      { class: 'banner', onclick: () => ((state.tab = 'running'), render()) },
      h('span', { class: 'status-dot on' }),
      h('span', { class: 'grow' }, `Syncing Blackboard · ${STEPS[at].name}`),
      h('span', { class: 'count' }, `${at + 1} of ${STEPS.length}`),
    )
  }
  const run = state.lastRun
  if (run && !run.ok && run.loginRequired) {
    return h(
      'button',
      { class: 'banner urgent', onclick: () => openUrl(`${BB_ORIGIN}/ultra/course`) },
      h('span', { class: 'alert' }, icon('alert', 16)),
      h('span', { class: 'grow' }, 'Log in to Blackboard, then sync again'),
      icon('externalLink', 14),
    )
  }
  return null
}

function overview(): HTMLElement[] {
  const sync = activeSync()
  const run = state.lastRun
  const s = summary()
  const via = run?.ok ? run.via : state.session?.status === 'connected' ? state.session.via : undefined
  const cards: HTMLElement[] = [
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Sync Blackboard'),
      h('p', {}, 'Reads your courses, due dates, grades, announcements and course content. Read-only: nothing on Blackboard changes.'),
      h(
        'div',
        { class: 'rows' },
        row('Last sync', run ? `${relativeTime(run.at)}${run.ok ? '' : ', failed'}` : 'Never'),
        s ? row('Found', `${plural(s.courses.length, 'course')} · ${s.todoItems} due`) : null,
        row('Reads Blackboard', via === 'tab' ? 'Through your open tab' : via === 'worker' ? 'In the background' : '–'),
      ),
      h('button', { class: 'primary', disabled: !!sync, onclick: startSync }, sync ? 'Syncing…' : 'Sync now'),
      s
        ? h('div', { class: 'note' }, h('button', { class: 'link', onclick: () => void downloadSnapshot() }, icon('download', 14), 'Download last sync (JSON)'))
        : null,
    ),
  ]
  // A login failure is already the banner; other failures get a card.
  if (run && !run.ok && !run.loginRequired && !sync) {
    cards.push(
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'card-label' }, 'Last sync didn’t finish'),
        h('p', { class: 'error-text' }, run.error),
      ),
    )
  }
  return cards
}

function courses(): HTMLElement[] {
  const list = sortedCourses()
  if (list.length === 0) return [h('div', { class: 'empty' }, 'No courses yet. Sync to pull them in.')]
  const card = (c: CourseRow) =>
    h(
      'section',
      { class: 'card' },
      h('h2', {}, c.name),
      h('p', {}, `${courseLabel(c)} · ${plural(c.announcements, 'announcement')} · ${plural(c.contents, 'content item')}`),
      h(
        'div',
        { class: 'course-meta' },
        h('span', {}, c.errors ? h('span', { class: 'error-text' }, plural(c.errors, 'problem')) : `${plural(c.columns, 'gradebook column')} · ${plural(c.grades, 'grade')}`),
        h('div', { class: 'course-actions' }, h('button', { class: 'text-button', onclick: () => openUrl(courseUrl(c)) }, 'Open')),
      ),
    )
  const modules = list.filter((c) => c.moduleCode)
  const other = list.filter((c) => !c.moduleCode)
  return [
    ...modules.map(card),
    other.length ? h('div', { class: 'group-label' }, 'Other courses') : null,
    ...other.map(card),
  ].filter((el): el is HTMLElement => el !== null)
}

function running(): HTMLElement[] {
  const statuses = stepStatuses()
  if (!statuses) return [h('div', { class: 'empty' }, 'Nothing running. Press Sync now to start.')]
  const circle = (status: StepStatus) =>
    h(
      'span',
      { class: `circle ${status}` },
      status === 'done' ? icon('check', 13, 3.5) : null,
      status === 'error' ? h('strong', { style: 'font-size:13px;line-height:1' }, '!') : null,
    )

  const roadmap = h('section', { class: 'card roadmap', 'aria-label': 'Progress' })
  statuses.forEach((status, i) => {
    if (i > 0) roadmap.append(h('span', { class: `line${status === 'done' || status === 'current' || status === 'error' ? ' done' : ''}` }))
    roadmap.append(circle(status))
  })

  const steps = h(
    'section',
    { class: 'card' },
    h(
      'ol',
      { class: 'steps' },
      ...STEPS.map((step, i) =>
        h(
          'li',
          { class: `step ${statuses[i]}`, 'aria-current': statuses[i] === 'current' ? 'step' : undefined },
          circle(statuses[i]),
          h('div', { class: 'step-name' }, step.name),
          statuses[i] === 'todo' && i === STEPS.length - 1 ? null : h('div', { class: 'step-detail' }, stepDetail(i, statuses[i])),
        ),
      ),
    ),
  )

  const out = [roadmap, steps]
  const run = state.lastRun
  const s = summary()
  if (!activeSync() && run?.ok && s) {
    const content = s.courses.reduce((n, c) => n + c.contents, 0)
    const announcements = s.courses.reduce((n, c) => n + c.announcements, 0)
    const grades = s.courses.reduce((n, c) => n + c.grades, 0)
    out.push(
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'card-label' }, `Synced ${relativeTime(run.at).toLowerCase()}`),
        h(
          'div',
          {},
          row('Courses', s.courses.length, 'tick'),
          row('Content items', content, 'tick'),
          row('Announcements', announcements, 'tick'),
          row('Grades released', grades, 'tick'),
          row('Due items', s.todoItems, 'tick'),
          row('Problems', s.errors, s.errors ? 'alert' : 'tick'),
        ),
        h('div', { class: 'note' }, 'Nothing on Blackboard was changed.'),
        h('div', { class: 'note' }, h('button', { class: 'link', onclick: () => void downloadSnapshot() }, icon('download', 14), 'Download JSON')),
      ),
    )
  } else if (!activeSync() && run && !run.ok && run.loginRequired) {
    out.push(
      h(
        'section',
        { class: 'card' },
        h('p', {}, 'Your Blackboard login has ended. Log in, then sync again.'),
        h('button', { class: 'primary', onclick: () => openUrl(`${BB_ORIGIN}/ultra/course`) }, 'Open Blackboard'),
      ),
    )
  }
  return out
}

// ---------- render ----------

const app = document.getElementById('app')!

function render() {
  document.documentElement.dataset.theme = state.theme ?? ''
  if (!state.theme) delete document.documentElement.dataset.theme
  const body = state.tab === 'overview' ? overview() : state.tab === 'courses' ? courses() : running()
  const scroll = app.querySelector('.chips')?.scrollLeft ?? 0
  app.replaceChildren(header(), strip(), tabs(), h('main', { class: 'content', role: 'tabpanel' }, banner(), detailCard(), ...body))
  const chips = app.querySelector('.chips')
  if (chips) chips.scrollLeft = scroll
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && STORAGE.syncState in changes) state.sync = changes[STORAGE.syncState].newValue as SyncState | undefined
  if (area === 'session' && STORAGE.session in changes) state.session = changes[STORAGE.session].newValue as SessionCheck | undefined
  if (area === 'local' && STORAGE.lastRun in changes) state.lastRun = changes[STORAGE.lastRun].newValue as LastRun | undefined
  if (area === 'local' && STORAGE.lastSummary in changes)
    state.lastSummary = changes[STORAGE.lastSummary].newValue as SnapshotSummary | undefined
  render()
})

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render)

async function init() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([STORAGE.lastRun, STORAGE.lastSummary, STORAGE.theme]),
    chrome.storage.session.get([STORAGE.syncState, STORAGE.session]),
  ])
  state.lastRun = local[STORAGE.lastRun] as LastRun | undefined
  // Installs from before lastSummary existed still have it inside lastRun.
  const last = state.lastRun
  state.lastSummary = (local[STORAGE.lastSummary] as SnapshotSummary | undefined) ?? (last?.ok ? last.summary : undefined)
  state.theme = local[STORAGE.theme] as Theme | undefined
  state.sync = session[STORAGE.syncState] as SyncState | undefined
  state.session = session[STORAGE.session] as SessionCheck | undefined
  // Reopened mid-sync: go straight to the run.
  if (activeSync()) state.tab = 'running'
  render()
  // Fresh "connected" check each time the panel opens (one request).
  if (!activeSync()) void chrome.runtime.sendMessage<WorkerMessage, SessionCheck>({ type: 'check' })
}

void init()
