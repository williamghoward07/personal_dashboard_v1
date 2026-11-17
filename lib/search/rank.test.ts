import { describe, expect, it } from 'vitest'
import { rankCandidates, rankCandidatesScored, scoreCandidate, type RankCandidate } from './rank'

const now = new Date('2026-11-16T12:00:00Z')

function cand(id: string, primary: string, extra: Partial<RankCandidate> = {}): RankCandidate {
  return {
    item: { module: 'todos', id, title: primary, subtitle: null },
    primary,
    secondary: [],
    date: null,
    ...extra,
  }
}
const ids = (r: { id: string }[]) => r.map((x) => x.id)

describe('ranking', () => {
  it('all-keywords beats a single keyword', () => {
    const out = rankCandidates([cand('one', 'tesco run'), cand('both', 'tesco food shop')], ['tesco', 'food'], now, 5)
    expect(ids(out)).toEqual(['both', 'one'])
  })

  it('title beats notes', () => {
    const out = rankCandidates([cand('notes', 'misc', { secondary: ['mentions essay'] }), cand('title', 'essay plan')], ['essay'], now, 5)
    expect(ids(out)).toEqual(['title', 'notes'])
  })

  it('word-boundary match scores above mid-word', () => {
    const a = scoreCandidate(cand('a', 'the cat sat'), ['cat'], now)
    const b = scoreCandidate(cand('b', 'concatenate'), ['cat'], now)
    expect(a).toBeGreaterThan(b)
  })

  it('recent beats old on a tie', () => {
    const out = rankCandidates(
      [cand('old', 'essay', { date: '2026-01-01' }), cand('new', 'essay', { date: '2026-11-10' })],
      ['essay'],
      now,
      5,
    )
    expect(ids(out)).toEqual(['new', 'old'])
  })

  it('near-future due dates count as recent', () => {
    const near = scoreCandidate(cand('n', 'x', { date: '2026-11-30' }), [], now)
    const far = scoreCandidate(cand('f', 'x', { date: '2027-06-01' }), [], now)
    expect(near).toBe(1)
    expect(far).toBe(0)
  })

  it('inactive sinks below an equally good live match', () => {
    const out = rankCandidates([cand('done', 'essay plan', { inactive: true }), cand('live', 'essay notes')], ['essay'], now, 5)
    expect(ids(out)).toEqual(['live', 'done'])
  })

  it('no keywords: recency only, inactive last', () => {
    const out = rankCandidates(
      [
        cand('old', 'a', { date: '2026-06-01' }),
        cand('doneNew', 'b', { date: '2026-11-15', inactive: true }),
        cand('new', 'c', { date: '2026-11-14' }),
      ],
      [],
      now,
      5,
    )
    expect(ids(out)).toEqual(['new', 'old', 'doneNew'])
  })

  it('respects limit and returns scores sorted', () => {
    const scored = rankCandidatesScored([cand('a', 'x'), cand('b', 'x y'), cand('c', 'z')], ['x'], now, 2)
    expect(scored).toHaveLength(2)
    expect(scored[0].score).toBeGreaterThanOrEqual(scored[1].score)
  })
})
