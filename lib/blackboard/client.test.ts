import { describe, expect, it } from 'vitest'
import {
  BB_ORIGIN,
  BbLoginRequiredError,
  absoluteUrl,
  getAllPages,
  getContentTree,
  parseCourseCode,
  snapshot,
  summariseSnapshot,
  todoItemKey,
  todoWindows,
  type BbFetch,
  type BbResponse,
} from './client'

type Route = unknown | { __response: Partial<BbResponse> }

/** Routes are keyed by path + query. Unknown paths 404. Records every URL requested. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = []
  const fetchFn: BbFetch = async (url) => {
    calls.push(url)
    const u = new URL(url)
    const key = u.pathname + u.search
    if (!(key in routes)) return { status: 404, url, body: { status: 404 } }
    const route = routes[key] as { __response?: Partial<BbResponse> }
    if (route && typeof route === 'object' && '__response' in route && route.__response) {
      return { status: 200, url, body: null, ...route.__response }
    }
    return { status: 200, url, body: route }
  }
  return { fetchFn, calls }
}

const noSleep = { delayMs: 0, sleep: async () => {} }

describe('absoluteUrl', () => {
  it('resolves relative paths against Blackboard, not the page base', () => {
    expect(absoluteUrl('/learn/api/x?a=1')).toBe(`${BB_ORIGIN}/learn/api/x?a=1`)
  })
})

describe('parseCourseCode', () => {
  it('splits module courses', () => {
    expect(parseCourseCode('GEOG1241_2026')).toEqual({ moduleCode: 'GEOG1241', year: 2026 })
  })
  it('gives org courses no module code', () => {
    expect(parseCourseCode('X_SCI_2026')).toEqual({ moduleCode: null, year: 2026 })
    expect(parseCourseCode('X_DCAD_TRANSITIONS_2026').moduleCode).toBeNull()
  })
})

describe('todoWindows', () => {
  it('splits a range into windows of at most 14 days', () => {
    const windows = todoWindows(new Date('2026-11-01T00:00:00Z'), new Date('2026-12-01T00:00:00Z'))
    expect(windows).toEqual([
      { since: '2026-11-01T00:00:00.000Z', until: '2026-11-15T00:00:00.000Z' },
      { since: '2026-11-15T00:00:00.000Z', until: '2026-11-29T00:00:00.000Z' },
      { since: '2026-11-29T00:00:00.000Z', until: '2026-12-01T00:00:00.000Z' },
    ])
  })
  it('returns nothing for an empty range', () => {
    const d = new Date('2026-11-01T00:00:00Z')
    expect(todoWindows(d, d)).toEqual([])
  })
})

describe('todoItemKey', () => {
  it('prefers the column id, then its content id, then title + due date', () => {
    expect(todoItemKey({ column: { id: 'c', contentId: 'x' } })).toBe('column:c')
    expect(todoItemKey({ column: { contentId: 'x' } })).toBe('content:x')
    expect(todoItemKey({ title: 'Essay', dueDate: 'd' })).toBe('title:Essay|d')
  })
})

describe('getAllPages', () => {
  it('follows nextPage until it is empty', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/a?limit=2': { results: [1, 2], paging: { nextPage: '/a?limit=2&offset=2' } },
      '/a?limit=2&offset=2': { results: [3], paging: { nextPage: '' } },
    })
    expect(await getAllPages(fetchFn, '/a?limit=2')).toEqual([1, 2, 3])
    expect(calls).toHaveLength(2)
  })

  it('treats a redirect to another host as logged out', async () => {
    const fetchFn: BbFetch = async () => ({ status: 200, url: 'https://login.microsoftonline.com/x', body: null })
    await expect(getAllPages(fetchFn, '/a')).rejects.toBeInstanceOf(BbLoginRequiredError)
  })

  it('treats a non-JSON 200 as the login page', async () => {
    const { fetchFn } = fakeFetch({ '/a': { __response: { body: null } } })
    await expect(getAllPages(fetchFn, '/a')).rejects.toBeInstanceOf(BbLoginRequiredError)
  })
})

describe('getContentTree', () => {
  const base = '/learn/api/public/v1/courses/_1_1/contents'
  const routes = {
    [`${base}?limit=100`]: {
      results: [
        { id: 'f1', title: 'Week 5', hasChildren: true },
        { id: 'doc', title: 'Handbook' },
      ],
    },
    [`${base}/f1/children?limit=100`]: { results: [{ id: 'f2', title: 'Readings', hasChildren: true }] },
    [`${base}/f2/children?limit=100`]: { results: [{ id: 'r1', title: 'Smith 2020' }] },
  }

  it('walks folders breadth-first with depth and path', async () => {
    const { fetchFn } = fakeFetch(routes)
    const tree = await getContentTree(fetchFn, '_1_1')
    expect(tree.items.map((i) => [i.id, i.depth, i.path])).toEqual([
      ['f1', 0, []],
      ['doc', 0, []],
      ['f2', 1, ['Week 5']],
      ['r1', 2, ['Week 5', 'Readings']],
    ])
    expect(tree.skippedFolders).toBe(0)
  })

  it('stops at maxDepth and counts the folders it skipped', async () => {
    const { fetchFn } = fakeFetch(routes)
    const tree = await getContentTree(fetchFn, '_1_1', { maxDepth: 2 })
    expect(tree.items.map((i) => i.id)).toEqual(['f1', 'doc', 'f2'])
    expect(tree.skippedFolders).toBe(1)
  })

  it('records a failing folder and carries on', async () => {
    const { fetchFn } = fakeFetch({ [`${base}?limit=100`]: routes[`${base}?limit=100`] })
    const tree = await getContentTree(fetchFn, '_1_1')
    expect(tree.items.map((i) => i.id)).toEqual(['f1', 'doc'])
    expect(tree.errors[0]).toMatch(/contents f1: Blackboard returned 404/)
  })
})

describe('snapshot', () => {
  const now = new Date('2026-11-09T00:00:00Z')
  const course = { id: '_10_1', courseId: 'GEOG1241_2026', name: 'Geographies of Crisis', isClosed: false }
  const routes: Record<string, Route> = {
    '/learn/api/public/v1/users/me': { id: '_99_1', userName: 'abcd12', studentId: 'secret' },
    '/learn/api/v1/users/_99_1/memberships?expand=course&limit=100': {
      results: [
        { id: 'm1', isAvailable: true, course },
        { id: 'm2', isAvailable: true, course: { id: '_11_1', courseId: 'GEOG0000_2025', isClosed: true } },
      ],
      paging: { nextPage: '' },
    },
    '/learn/api/public/v2/courses/_10_1/gradebook/columns?limit=100': { results: [{ id: 'c1' }] },
    '/learn/api/public/v1/courses/_10_1/announcements?limit=100': { results: [{ id: 'a1' }, { id: 'a2' }] },
    '/learn/api/public/v1/courses/_10_1/contents?limit=100': { results: [{ id: 'doc' }] },
  }
  // One 14-day window either side of `now` so the test controls the To Do routes.
  const todoRoute = (since: string, until: string) =>
    `/learn/api/v1/calendars/todo/studentItems?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`
  // Real To Do items have no id; the same overdue item can show up in more than one window.
  const essay = { title: 'Essay', dueDate: '2026-11-05T12:00:00.000Z', column: { id: '_c1_1', contentId: '_x1_1' } }
  const quiz = { title: 'Quiz', dueDate: '2026-11-20T12:00:00.000Z', column: { contentId: '_x2_1' } }
  routes[todoRoute('2026-10-26T00:00:00.000Z', '2026-11-09T00:00:00.000Z')] = {
    overdueItems: [essay],
    dueTodayItems: [],
    futureDueItems: [],
  }
  routes[todoRoute('2026-11-09T00:00:00.000Z', '2026-11-23T00:00:00.000Z')] = {
    overdueItems: [essay],
    dueTodayItems: [],
    futureDueItems: [quiz],
  }

  it('collects current courses, isolates section errors and dedupes To Do in the summary', async () => {
    const { fetchFn } = fakeFetch(routes)
    const snap = await snapshot(fetchFn, { now, todoPastDays: 14, todoFutureDays: 14, ...noSleep })

    expect(snap.user).toEqual({ id: '_99_1', userName: 'abcd12' })
    expect(snap.courses).toHaveLength(1)
    const [c] = snap.courses
    expect(c).toMatchObject({ bbId: '_10_1', courseCode: 'GEOG1241_2026', moduleCode: 'GEOG1241' })
    expect(c.membership).not.toHaveProperty('course')
    expect(c.columns).toHaveLength(1)
    expect(c.announcements).toHaveLength(2)
    // The grades route is missing (404): recorded, not fatal.
    expect(c.grades).toEqual([])
    expect(c.errors).toEqual([expect.stringMatching(/^grades: Blackboard returned 404/)])
    expect(snap.todo).toHaveLength(2)

    const summary = summariseSnapshot(snap)
    expect(summary.todoItems).toBe(2)
    expect(summary.errors).toBe(1)
    expect(summary.courses[0]).toMatchObject({ columns: 1, grades: 0, announcements: 2, contents: 1 })
    expect(summary.requestCount).toBe(snap.requestCount)
  })

  it('treats 401 and 403 on users/me as logged out', async () => {
    for (const status of [401, 403]) {
      const fetchFn: BbFetch = async (url) => ({ status, url, body: {} })
      await expect(snapshot(fetchFn, { now, ...noSleep })).rejects.toBeInstanceOf(BbLoginRequiredError)
    }
  })

  it('aborts the whole snapshot if the session drops mid-way', async () => {
    const { fetchFn: inner } = fakeFetch(routes)
    const fetchFn: BbFetch = async (url) =>
      url.includes('/announcements') ? { status: 302, url: 'https://login.microsoftonline.com/', body: null } : inner(url)
    await expect(snapshot(fetchFn, { now, ...noSleep })).rejects.toBeInstanceOf(BbLoginRequiredError)
  })

  it('reports each stage in order, with course and window counts', async () => {
    const { fetchFn } = fakeFetch(routes)
    const seen: string[] = []
    await snapshot(fetchFn, {
      now,
      todoPastDays: 14,
      todoFutureDays: 14,
      ...noSleep,
      onProgress: (p) =>
        seen.push(
          p.stage === 'content'
            ? `content ${p.courseCode} ${p.courseIndex}/${p.courseCount}`
            : p.stage === 'todo'
              ? `todo ${p.windowIndex}/${p.windowCount}`
              : p.stage,
        ),
    })
    expect(seen).toEqual(['session', 'courses', 'content GEOG1241_2026 1/1', 'todo 1/2', 'todo 2/2'])
  })

  it('waits between requests', async () => {
    const { fetchFn } = fakeFetch(routes)
    const waits: number[] = []
    const snap = await snapshot(fetchFn, {
      now,
      todoPastDays: 14,
      todoFutureDays: 14,
      delayMs: 150,
      sleep: async (ms) => {
        waits.push(ms)
      },
    })
    expect(waits).toHaveLength(snap.requestCount - 1)
    expect(new Set(waits)).toEqual(new Set([150]))
  })
})
