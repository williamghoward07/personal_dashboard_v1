import { describe, expect, it } from 'vitest'
import { normalizeUsername, parseInstagramSnapshot, previewSnapshot, relationshipLabel } from './instagram-import'
import { buildInstagramPrompt, INSTAGRAM_JSON_EXAMPLE } from './instagram-prompt'

const TODAY = '2026-09-16'

function parse(value: unknown) {
  return parseInstagramSnapshot(typeof value === 'string' ? value : JSON.stringify(value), TODAY)
}

describe('parseInstagramSnapshot', () => {
  it('normalises usernames, drops duplicates and keeps display names', () => {
    const result = parse({
      captured_on: '2026-09-15',
      following: [{ username: '@Sam.K', display_name: ' Sam K ' }, { username: 'sam.k' }, 'jo_b'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.snapshot.following).toEqual([
      { username: 'sam.k', display_name: 'Sam K', approx_date: null },
      { username: 'jo_b', display_name: null, approx_date: null },
    ])
    expect(result.snapshot.followers).toEqual([])
    expect(result.snapshot.baseline).toBe(false)
  })

  it("reads Claude's reply even with a code fence and chatter around it", () => {
    const reply = `Here you go:\n\`\`\`json\n${INSTAGRAM_JSON_EXAMPLE}\n\`\`\`\nLet me know if…`
    const result = parse(reply)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.snapshot.following[0].username).toBe('sam.k')
    expect(result.snapshot.followers[0].approx_date).toBe('2026-09-14')
  })

  it('clamps approx dates to the capture day and ignores bad ones', () => {
    const result = parse({
      captured_on: '2026-09-10',
      followers: [
        { username: 'a', approx_date: '2026-09-12' },
        { username: 'b', approx_date: '2026-02-30' },
        { username: 'c', approx_date: 'yesterday' },
      ],
    })
    expect(result.ok && result.snapshot.followers.map((f) => f.approx_date)).toEqual(['2026-09-10', null, null])
  })

  it('defaults captured_on to today and honours baseline', () => {
    const result = parse({ baseline: true, followers: ['x'] })
    expect(result.ok && result.snapshot).toMatchObject({ captured_on: TODAY, baseline: true })
  })

  it('rejects bad input with a readable reason', () => {
    expect(parse('not json')).toMatchObject({ ok: false })
    expect(parse([1, 2])).toMatchObject({ ok: false })
    expect(parse({ following: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/no accounts/i) })
    expect(parse({ following: [{ username: 'bad name' }] })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/bad name/),
    })
    expect(parse({ following: [{ display_name: 'No username' }] })).toMatchObject({ ok: false })
    expect(parse({ following: 'sam' })).toMatchObject({ ok: false })
    expect(parse({ captured_on: '2026-09-20', following: ['a'] })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/future/),
    })
    expect(parse({ captured_on: '16/09/2026', following: ['a'] })).toMatchObject({ ok: false })
    expect(parse({ following: ['a'.repeat(31)] })).toMatchObject({ ok: false })
  })
})

describe('previewSnapshot', () => {
  const snapshot = {
    captured_on: TODAY,
    baseline: false,
    following: [
      { username: 'known', display_name: null, approx_date: null },
      { username: 'new_one', display_name: null, approx_date: null },
    ],
    followers: [
      { username: 'known', display_name: null, approx_date: null },
      { username: 'fan', display_name: null, approx_date: null },
    ],
  }

  it('only counts relationships not seen before', () => {
    const preview = previewSnapshot(snapshot, [{ username: 'known', i_follow: true, follows_me: false }])
    expect(preview.newFollowing.map((e) => e.username)).toEqual(['new_one'])
    expect(preview.newFollowers.map((e) => e.username)).toEqual(['known', 'fan'])
    expect(preview.newAccounts).toBe(2)
    expect(preview.unchanged).toBe(1)
  })

  it('never infers unfollows from accounts missing in the snapshot', () => {
    const preview = previewSnapshot({ ...snapshot, following: [], followers: [] }, [
      { username: 'gone', i_follow: true, follows_me: true },
    ])
    expect(preview).toEqual({ newFollowing: [], newFollowers: [], newAccounts: 0, unchanged: 0 })
  })
})

describe('helpers', () => {
  it('normalizeUsername', () => {
    expect(normalizeUsername('  @@Jo.B ')).toBe('jo.b')
  })

  it('relationshipLabel', () => {
    expect(relationshipLabel({ i_follow: true, follows_me: true })).toBe('Mutual')
    expect(relationshipLabel({ i_follow: true, follows_me: false })).toBe('You follow')
    expect(relationshipLabel({ i_follow: false, follows_me: true })).toBe('Follows you')
    expect(relationshipLabel({ i_follow: false, follows_me: false })).toBeNull()
  })

  it('buildInstagramPrompt carries the date, baseline flag and schema', () => {
    const prompt = buildInstagramPrompt({ capturedOn: '2026-09-16', baseline: true })
    expect(prompt).toContain('taken on 2026-09-16')
    expect(prompt).toContain('"baseline" to true')
    expect(prompt).toContain(INSTAGRAM_JSON_EXAMPLE)
    expect(prompt).toMatch(/never guess/i)
  })
})
