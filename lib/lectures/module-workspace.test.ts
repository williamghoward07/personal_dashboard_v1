import { describe, expect, it } from 'vitest'
import { isModuleWorkspace, normalizeModuleCode } from './module-workspace'

describe('normalizeModuleCode', () => {
  it('uppercases and strips spaces', () => {
    expect(normalizeModuleCode(' geog 1081 ')).toBe('GEOG1081')
  })
  it('rejects anything else', () => {
    expect(normalizeModuleCode('GEOG108')).toBeNull()
    expect(normalizeModuleCode('Physical Geography')).toBeNull()
  })
})

describe('isModuleWorkspace', () => {
  it('is true only with a code (and tolerates the column being absent)', () => {
    expect(isModuleWorkspace({ module_code: 'GEOG1081' })).toBe(true)
    expect(isModuleWorkspace({ module_code: null })).toBe(false)
    expect(isModuleWorkspace({})).toBe(false)
  })
})
