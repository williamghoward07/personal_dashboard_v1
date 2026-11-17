import { describe, expect, it } from 'vitest'
import { normaliseDrafts } from './normalise'

const act = (over: Record<string, unknown> = {}) => ({ title: 'Do it', due_date: null, due_time: null, notes: null, ...over })
const todo = (a: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ kind: 'todo', act: act(a), ...extra })
const run = (drafts: unknown[], ids: string[] = ['p1']) => normaliseDrafts({ drafts }, ids).drafts

describe('normaliseDrafts', () => {
  it('returns empty for junk input', () => {
    expect(normaliseDrafts(null, [])).toEqual({ drafts: [] })
    expect(normaliseDrafts('x', [])).toEqual({ drafts: [] })
    expect(normaliseDrafts({}, [])).toEqual({ drafts: [] })
    expect(normaliseDrafts({ drafts: 'no' }, [])).toEqual({ drafts: [] })
  })

  it('drops unknown kinds', () => {
    expect(run([{ kind: 'reminder', act: act() }])).toEqual([])
  })

  it('drops drafts missing their payload', () => {
    expect(
      run([
        { kind: 'todo', act: act({ title: '   ' }) },
        { kind: 'education_task' },
        { kind: 'calendar_event', act: null },
        { kind: 'new_person', person: { full_name: ' ' } },
        { kind: 'update_person' },
        { kind: 'log_interaction', interaction: { summary: '' } },
      ])
    ).toEqual([])
  })

  it('trims titles and summaries', () => {
    const [d, i] = run([todo({ title: '  Buy milk ' }), { kind: 'log_interaction', interaction: { summary: ' Chatted ' } }])
    expect(d.act?.title).toBe('Buy milk')
    expect(i.interaction?.summary).toBe('Chatted')
  })

  it('nulls invalid dates and times', () => {
    const [a, b, c] = run([
      todo({ title: 'a', due_date: '2026-02-30', due_time: '25:00' }),
      todo({ title: 'b', due_date: 'friday', due_time: '5pm' }),
      todo({ title: 'c', due_date: '2026-02-27', due_time: '17:00' }),
    ])
    expect(a.act).toMatchObject({ due_date: null, due_time: null })
    expect(b.act).toMatchObject({ due_date: null, due_time: null })
    expect(c.act).toMatchObject({ due_date: '2026-02-27', due_time: '17:00' })
  })

  it('keeps due_time only for todo and calendar_event', () => {
    const out = run([
      { kind: 'education_task', act: act({ title: 'e', due_time: '10:00' }) },
      { kind: 'calendar_event', act: act({ title: 'c', due_time: '10:00' }) },
    ])
    expect(out[0].act?.due_time).toBeNull()
    expect(out[1].act?.due_time).toBe('10:00')
  })

  it('nulls unparseable occurred_at', () => {
    const [a, b] = run([
      { kind: 'log_interaction', interaction: { summary: 'a', occurred_at: 'yesterday-ish' } },
      { kind: 'log_interaction', interaction: { summary: 'b', occurred_at: '2026-11-15T10:00:00Z' } },
    ])
    expect(a.interaction?.occurred_at).toBeNull()
    expect(b.interaction?.occurred_at).toBe('2026-11-15T10:00:00Z')
  })

  it('validates and clamps person_match', () => {
    const [a, b, c, d] = run([
      { kind: 'log_interaction', interaction: { summary: 'a' }, person_match: { id: 'zzz', confidence: 0.9 } },
      { kind: 'log_interaction', interaction: { summary: 'b' }, person_match: { id: 'p1', confidence: 'high' } },
      { kind: 'log_interaction', interaction: { summary: 'c' }, person_match: { id: 'p1', confidence: 4 } },
      { kind: 'update_person', person: { notes: 'n' }, person_match: { id: 'p1', confidence: -1 } },
    ])
    expect(a.person_match).toBeNull()
    expect(b.person_match).toBeNull()
    expect(c.person_match).toEqual({ id: 'p1', confidence: 1 })
    expect(d.person_match).toEqual({ id: 'p1', confidence: 0 })
  })

  it('nulls fields that do not belong to the kind and always sets all four keys', () => {
    const [t, p] = run([
      todo({}, { person: { full_name: 'X' }, interaction: { summary: 's' }, person_match: { id: 'p1', confidence: 1 } }),
      { kind: 'new_person', person: { full_name: 'Priya' }, act: act(), person_match: { id: 'p1', confidence: 1 } },
    ])
    expect(t).toMatchObject({ person: null, interaction: null, person_match: null })
    expect(p).toMatchObject({ act: null, interaction: null, person_match: null })
    expect(Object.keys(p).sort()).toEqual(['act', 'interaction', 'kind', 'person', 'person_match'])
  })

  it('removes exact duplicates', () => {
    const out = run([todo({ title: 'Call Mum', due_date: '2026-11-17' }), todo({ title: ' call mum ', due_date: '2026-11-17' }), todo({ title: 'Call Mum' })])
    expect(out).toHaveLength(2)
  })

  it('caps at 30 drafts', () => {
    const many = Array.from({ length: 45 }, (_, i) => todo({ title: `t${i}` }))
    expect(run(many)).toHaveLength(30)
  })
})
