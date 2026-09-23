import { describe, expect, it } from 'vitest'
import type { HomeLayoutEntry } from '@/lib/settings/schema'
import {
  HOME_WIDGETS,
  HOME_WIDGET_IDS,
  SPAN_CLASS,
  defaultHomeLayout,
  hiddenWidgets,
  homeWidgetLabel,
  homeWidgetMeta,
  isDefaultLayout,
  reorderLayout,
  resolveHomeLayout,
  setWidgetHidden,
  setWidgetSpan,
  spanClass,
  spanFromPointer,
  toggleWidgetHidden,
  visibleWidgets,
} from './layout'

function entry(id: string, span = 1, hidden = false): HomeLayoutEntry {
  return { id, span: span as HomeLayoutEntry['span'], hidden }
}

describe('registry', () => {
  it('has unique, stable ids', () => {
    expect(new Set(HOME_WIDGET_IDS).size).toBe(HOME_WIDGET_IDS.length)
    expect(HOME_WIDGET_IDS).toContain('daily-goals')
    expect(HOME_WIDGET_IDS).toContain('calendar')
  })

  it('registers Health hidden by default (the /health page is parked)', () => {
    expect(homeWidgetMeta('health')?.defaultHidden).toBe(true)
    expect(HOME_WIDGETS.filter((w) => w.defaultHidden).map((w) => w.id)).toEqual(['health'])
  })

  it('labels every widget, and falls back to the id for an unknown one', () => {
    for (const widget of HOME_WIDGETS) expect(homeWidgetLabel(widget.id)).toBe(widget.label)
    expect(homeWidgetLabel('not-a-widget')).toBe('not-a-widget')
    expect(homeWidgetMeta('not-a-widget')).toBeUndefined()
  })
})

describe('span classes', () => {
  it('are written out in full so Tailwind can see them', () => {
    for (const value of Object.values(SPAN_CLASS)) expect(value).not.toContain('${')
    expect(SPAN_CLASS[4]).toContain('xl:col-span-4')
  })

  it('collapses wide spans to two columns at the sm breakpoint', () => {
    expect(spanClass(3)).toContain('sm:col-span-2')
    expect(spanClass(4)).toContain('sm:col-span-2')
    expect(spanClass(1)).toContain('sm:col-span-1')
  })
})

describe('defaultHomeLayout', () => {
  it('mirrors the registry', () => {
    const layout = defaultHomeLayout()
    expect(layout.map((e) => e.id)).toEqual([...HOME_WIDGET_IDS])
    expect(layout.every((e) => e.span === 1)).toBe(true)
    expect(isDefaultLayout(layout)).toBe(true)
  })

  it('returns a fresh array each call (callers mutate their copy)', () => {
    const a = defaultHomeLayout()
    a[0].span = 4
    expect(defaultHomeLayout()[0].span).toBe(1)
  })
})

describe('resolveHomeLayout', () => {
  it('falls back to registry defaults with nothing saved', () => {
    expect(resolveHomeLayout(null)).toEqual(defaultHomeLayout())
    expect(resolveHomeLayout([])).toEqual(defaultHomeLayout())
    expect(resolveHomeLayout(undefined)).toEqual(defaultHomeLayout())
  })

  it('preserves saved order and puts saved widgets first', () => {
    const resolved = resolveHomeLayout([entry('money', 2), entry('daily-goals', 1)])
    expect(resolved.slice(0, 2).map((e) => e.id)).toEqual(['money', 'daily-goals'])
    expect(resolved[0].span).toBe(2)
  })

  it('drops ids that are no longer registered', () => {
    const resolved = resolveHomeLayout([entry('a-retired-widget'), entry('money')])
    expect(resolved.map((e) => e.id)).not.toContain('a-retired-widget')
    expect(resolved).toHaveLength(HOME_WIDGET_IDS.length)
  })

  it('appends newly-registered widgets with their registry defaults, not bare defaults', () => {
    // A layout saved before `health` was registered must not make it visible.
    const saved = HOME_WIDGET_IDS.filter((id) => id !== 'health').map((id) => entry(id))
    const resolved = resolveHomeLayout(saved)
    const health = resolved.find((e) => e.id === 'health')
    expect(health).toEqual({ id: 'health', span: 1, hidden: true })
  })

  it('respects an explicit saved override of a hidden-by-default widget', () => {
    const resolved = resolveHomeLayout([entry('health', 2, false)])
    expect(resolved[0]).toEqual({ id: 'health', span: 2, hidden: false })
  })

  it('clamps out-of-range saved spans', () => {
    const resolved = resolveHomeLayout([entry('money', 9), entry('habits', 0)])
    expect(resolved[0].span).toBe(4)
    expect(resolved[1].span).toBe(1)
  })
})

describe('visible / hidden partition', () => {
  const layout = [entry('a'), entry('b', 1, true), entry('c', 2)]

  it('splits without reordering', () => {
    expect(visibleWidgets(layout).map((e) => e.id)).toEqual(['a', 'c'])
    expect(hiddenWidgets(layout).map((e) => e.id)).toEqual(['b'])
  })
})

describe('reorderLayout', () => {
  const layout = [entry('a'), entry('b'), entry('c'), entry('d')]

  it('moves forwards', () => {
    expect(reorderLayout(layout, 'a', 'c').map((e) => e.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves backwards', () => {
    expect(reorderLayout(layout, 'd', 'b').map((e) => e.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('keeps hidden entries in the array so restoring them lands in the same place', () => {
    const withHidden = [entry('a'), entry('hidden', 1, true), entry('b')]
    const moved = reorderLayout(withHidden, 'b', 'a')
    expect(moved.map((e) => e.id)).toEqual(['b', 'a', 'hidden'])
    expect(moved.find((e) => e.id === 'hidden')?.hidden).toBe(true)
  })

  it('is a no-op for unknown ids or a self-drop, and never mutates the input', () => {
    expect(reorderLayout(layout, 'a', 'a').map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(reorderLayout(layout, 'nope', 'c').map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(reorderLayout(layout, 'a', 'nope').map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(layout.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('setWidgetSpan', () => {
  const layout = [entry('a'), entry('b')]

  it('sets and clamps', () => {
    expect(setWidgetSpan(layout, 'b', 3)[1].span).toBe(3)
    expect(setWidgetSpan(layout, 'b', 7)[1].span).toBe(4)
    expect(setWidgetSpan(layout, 'b', -1)[1].span).toBe(1)
  })

  it('leaves other widgets and the input alone', () => {
    const next = setWidgetSpan(layout, 'b', 4)
    expect(next[0]).toEqual(layout[0])
    expect(layout[1].span).toBe(1)
    expect(setWidgetSpan(layout, 'missing', 4)).toEqual(layout)
  })
})

describe('hidden toggles', () => {
  const layout = [entry('a'), entry('b', 1, true)]

  it('toggles', () => {
    expect(toggleWidgetHidden(layout, 'a')[0].hidden).toBe(true)
    expect(toggleWidgetHidden(layout, 'b')[1].hidden).toBe(false)
  })

  it('sets explicitly and keeps span and position', () => {
    const next = setWidgetHidden([entry('a', 3)], 'a', true)
    expect(next[0]).toEqual({ id: 'a', span: 3, hidden: true })
  })

  it('is a no-op for an unknown id', () => {
    expect(toggleWidgetHidden(layout, 'missing')).toEqual(layout)
  })
})

describe('isDefaultLayout', () => {
  it('rejects a reordered, resized or partly-hidden layout', () => {
    expect(isDefaultLayout(reorderLayout(defaultHomeLayout(), 'money', 'daily-goals'))).toBe(false)
    expect(isDefaultLayout(setWidgetSpan(defaultHomeLayout(), 'money', 2))).toBe(false)
    expect(isDefaultLayout(toggleWidgetHidden(defaultHomeLayout(), 'money'))).toBe(false)
    expect(isDefaultLayout(defaultHomeLayout().slice(1))).toBe(false)
  })
})

describe('spanFromPointer', () => {
  // A 4-column grid, 300px tracks with a 20px card gap: span-1 is 300px
  // wide, span-2 620px, span-3 940px, span-4 1260px.
  const track = 300
  const gap = 20
  const left = 100

  it('snaps to the nearest whole span', () => {
    expect(spanFromPointer(left + 300, left, track, gap)).toBe(1)
    expect(spanFromPointer(left + 620, left, track, gap)).toBe(2)
    expect(spanFromPointer(left + 940, left, track, gap)).toBe(3)
    expect(spanFromPointer(left + 1260, left, track, gap)).toBe(4)
  })

  it('snaps at the midpoint between two spans', () => {
    expect(spanFromPointer(left + 455, left, track, gap)).toBe(1)
    expect(spanFromPointer(left + 465, left, track, gap)).toBe(2)
  })

  it('clamps beyond either end of the grid', () => {
    expect(spanFromPointer(left - 500, left, track, gap)).toBe(1)
    expect(spanFromPointer(left + 5000, left, track, gap)).toBe(4)
  })

  it('keeps the current span when the grid measures as zero-width', () => {
    expect(spanFromPointer(left + 400, left, 0, 0, 3)).toBe(3)
    expect(spanFromPointer(left + 400, left, Number.NaN, gap, 2)).toBe(2)
  })
})
