import { describe, expect, it } from 'vitest'
import { STORAGE, activeDashboard, dashboardOrigin, hostOf, readTargets } from './shared'

const live = { url: 'https://copilot.example.com', token: 'live-token' }
const test = { url: 'http://localhost:3000', token: 'test-token' }

describe('readTargets', () => {
  it('starts on Live with nothing set up', () => {
    expect(readTargets({})).toEqual({ active: 'live' })
  })

  it('moves a pre-Live/Test dashboard into Live', () => {
    expect(readTargets({ [STORAGE.dashboard]: live })).toEqual({ active: 'live', live })
  })

  it('ignores a half-saved legacy dashboard', () => {
    expect(readTargets({ [STORAGE.dashboard]: { url: live.url, token: '' } })).toEqual({ active: 'live' })
  })

  it('prefers the stored targets over the legacy entry', () => {
    const targets = { active: 'test' as const, live, test }
    expect(readTargets({ [STORAGE.dashboards]: targets, [STORAGE.dashboard]: live })).toBe(targets)
  })
})

describe('activeDashboard', () => {
  it('returns the active target tagged with its id', () => {
    expect(activeDashboard({ active: 'test', live, test })).toEqual({ ...test, target: 'test' })
    expect(activeDashboard({ active: 'live', live, test })).toEqual({ ...live, target: 'live' })
  })

  it('is undefined when the active target is not set up, even if the other is', () => {
    expect(activeDashboard({ active: 'test', live })).toBeUndefined()
  })
})

describe('hostOf', () => {
  it('keeps the port', () => {
    expect(hostOf('http://localhost:3000')).toBe('localhost:3000')
  })
})

describe('dashboardOrigin', () => {
  it('allows https anywhere and http only on localhost', () => {
    expect(dashboardOrigin('https://copilot.example.com/path')).toBe('https://copilot.example.com')
    expect(dashboardOrigin('http://localhost:3000/')).toBe('http://localhost:3000')
    expect(dashboardOrigin('http://copilot.example.com')).toBeNull()
  })
})
