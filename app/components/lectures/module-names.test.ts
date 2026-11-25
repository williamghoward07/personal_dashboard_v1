import { describe, expect, it } from 'vitest'
import { moduleNameMap, stripYearTag } from './module-names'

type Item = Parameters<typeof moduleNameMap>[0][number]
const item = (moduleCode: string | null, courseName: string | null, sessionName?: string): Item => ({
  moduleCode,
  courseName,
  session: sessionName ? ({ moduleName: sessionName } as Item['session']) : undefined,
})

describe('stripYearTag', () => {
  it('removes a trailing year tag only', () => {
    expect(stripYearTag('Physical Geography (26/27)')).toBe('Physical Geography')
    expect(stripYearTag('Introduction to Geographical Research (BA)')).toBe('Introduction to Geographical Research (BA)')
    expect(stripYearTag('Maps (26/27) and more')).toBe('Maps (26/27) and more')
  })
})

describe('moduleNameMap', () => {
  it('prefers the timetable name over the course name, wherever the session item is', () => {
    const names = moduleNameMap([
      item('GEOG1081', 'Physical Geography (26/27)'),
      item('GEOG1081', 'Physical Geography (26/27)', 'Physical Geography'),
    ])
    expect(names.get('GEOG1081')).toBe('Physical Geography')
  })
  it('falls back to the course name without its year tag', () => {
    expect(moduleNameMap([item('GEOG1061', 'Environment and Society (26/27)')]).get('GEOG1061')).toBe('Environment and Society')
  })
  it('leaves out a code with no name, and items with no code', () => {
    const names = moduleNameMap([item('GEOG1222', null), item(null, 'Academic Integrity (UG)')])
    expect(names.size).toBe(0)
  })
})
