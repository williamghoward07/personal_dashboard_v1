import { describe, expect, it } from 'vitest'
import { parseFollowingExport } from './follows'

function exportJson(following: unknown[]): string {
  return JSON.stringify({ relationships_following: following })
}

describe('parseFollowingExport', () => {
  it('converts unix-second timestamps and normalises handles', () => {
    const result = parseFollowingExport(
      exportJson([{ string_list_data: [{ value: '@Sam.K', href: 'https://instagram.com/sam.k', timestamp: 1_737_000_000 }] }])
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.follows).toEqual([{ handle: 'sam.k', followed_at: new Date(1_737_000_000 * 1000).toISOString() }])
  })

  it('drops duplicate handles', () => {
    const entry = { string_list_data: [{ value: 'jo_b', timestamp: 1_700_000_000 }] }
    const result = parseFollowingExport(exportJson([entry, entry]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.follows).toHaveLength(1)
  })

  it('rejects invalid JSON', () => {
    expect(parseFollowingExport('not json')).toMatchObject({ ok: false })
  })

  it('rejects a payload missing relationships_following', () => {
    expect(parseFollowingExport(JSON.stringify({ following: [] }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/relationships_following/),
    })
  })

  it('rejects an entry with no string_list_data', () => {
    const result = parseFollowingExport(exportJson([{}]))
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/string_list_data/) })
  })

  it('rejects an entry with no numeric timestamp', () => {
    const result = parseFollowingExport(exportJson([{ string_list_data: [{ value: 'sam.k' }] }]))
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/timestamp/) })
  })

  it('rejects an invalid handle', () => {
    const result = parseFollowingExport(exportJson([{ string_list_data: [{ value: 'bad handle!', timestamp: 1 }] }]))
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/valid Instagram handle/) })
  })

  it('rejects an export with zero follows', () => {
    expect(parseFollowingExport(exportJson([]))).toMatchObject({ ok: false, error: expect.stringMatching(/no follows/i) })
  })
})
