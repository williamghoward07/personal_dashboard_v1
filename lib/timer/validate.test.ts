import { describe, expect, it } from 'vitest'
import {
  LABEL_MAX,
  isDateKey,
  isUuid,
  parseClient,
  parseDayRange,
  parseJsonObject,
  parseLimit,
  parseOptionalInstant,
  parseOptionalText,
} from './validate'

describe('parseJsonObject', () => {
  it('treats an empty body as {}', () => {
    expect(parseJsonObject('')).toEqual({})
    expect(parseJsonObject('  ')).toEqual({})
  })

  it('accepts an object and rejects anything else', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonObject('[1]')).toBeNull()
    expect(parseJsonObject('"x"')).toBeNull()
    expect(parseJsonObject('null')).toBeNull()
    expect(parseJsonObject('{nope')).toBeNull()
  })
})

describe('isUuid', () => {
  it('accepts uuids only', () => {
    expect(isUuid('3f1c2b9e-8d2a-4c1e-9b7a-1a2b3c4d5e6f')).toBe(true)
    expect(isUuid('3f1c2b9e-8d2a-4c1e-9b7a-1a2b3c4d5e6')).toBe(false)
    expect(isUuid(42)).toBe(false)
  })
})

describe('parseClient', () => {
  it('defaults to web', () => {
    expect(parseClient(undefined)).toEqual({ ok: true, value: 'web' })
  })

  it('accepts the four clients and nothing else', () => {
    for (const c of ['web', 'mac', 'shortcut', 'phone']) expect(parseClient(c)).toEqual({ ok: true, value: c })
    expect(parseClient('windows')).toEqual({ ok: false })
    expect(parseClient(1)).toEqual({ ok: false })
  })
})

describe('parseOptionalText', () => {
  it('trims, and blank becomes null', () => {
    expect(parseOptionalText('  Hydrology reading ', LABEL_MAX)).toEqual({ ok: true, value: 'Hydrology reading' })
    expect(parseOptionalText('   ', LABEL_MAX)).toEqual({ ok: true, value: null })
    expect(parseOptionalText(undefined, LABEL_MAX)).toEqual({ ok: true, value: null })
  })

  it('rejects non-strings and over-long text', () => {
    expect(parseOptionalText(5, LABEL_MAX)).toEqual({ ok: false })
    expect(parseOptionalText('x'.repeat(LABEL_MAX + 1), LABEL_MAX)).toEqual({ ok: false })
  })
})

describe('parseOptionalInstant', () => {
  it('normalises an instant with an offset to UTC', () => {
    expect(parseOptionalInstant('2026-10-25T01:30:00+01:00')).toEqual({ ok: true, value: '2026-10-25T00:30:00.000Z' })
    expect(parseOptionalInstant('2026-10-25T14:30Z')).toEqual({ ok: true, value: '2026-10-25T14:30:00.000Z' })
    expect(parseOptionalInstant(undefined)).toEqual({ ok: true, value: null })
  })

  it('rejects times without an offset, and junk', () => {
    expect(parseOptionalInstant('2026-10-25T14:30:00')).toEqual({ ok: false })
    expect(parseOptionalInstant('2026-10-25')).toEqual({ ok: false })
    expect(parseOptionalInstant('20 minutes ago')).toEqual({ ok: false })
    expect(parseOptionalInstant('2026-13-45T14:30:00Z')).toEqual({ ok: false })
  })
})

describe('isDateKey / parseDayRange', () => {
  it('accepts real calendar dates only', () => {
    expect(isDateKey('2026-10-25')).toBe(true)
    expect(isDateKey('2028-02-29')).toBe(true)
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-1-5')).toBe(false)
  })

  it('needs from <= to', () => {
    expect(parseDayRange('2026-10-01', '2026-10-31')).toEqual({ ok: true, value: { from: '2026-10-01', to: '2026-10-31' } })
    expect(parseDayRange('2026-10-25', '2026-10-25')).toEqual({ ok: true, value: { from: '2026-10-25', to: '2026-10-25' } })
    expect(parseDayRange('2026-10-31', '2026-10-01')).toEqual({ ok: false })
    expect(parseDayRange('2026-10-01', null)).toEqual({ ok: false })
  })
})

describe('parseLimit', () => {
  it('defaults to 8 and accepts 1..50', () => {
    expect(parseLimit(null)).toEqual({ ok: true, value: 8 })
    expect(parseLimit('20')).toEqual({ ok: true, value: 20 })
    expect(parseLimit('0')).toEqual({ ok: false })
    expect(parseLimit('51')).toEqual({ ok: false })
    expect(parseLimit('3.5')).toEqual({ ok: false })
  })
})
