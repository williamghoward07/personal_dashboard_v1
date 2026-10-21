import { describe, expect, it } from 'vitest'
import { timerError } from './errors'

describe('timerError', () => {
  it.each([
    ['no_open_session', 404],
    ['workspace_not_found', 404],
    ['not_running', 409],
    ['not_paused', 409],
    ['invalid_trim', 400],
    ['invalid_range', 400],
    ['unauthenticated', 401],
  ])('maps %s to %i', (key, status) => {
    expect(timerError(key)).toEqual({ error: key, status })
  })

  it('hides unknown database errors behind a 500', () => {
    expect(timerError('duplicate key value violates unique constraint')).toEqual({ error: 'timer_failed', status: 500 })
    expect(timerError(undefined)).toEqual({ error: 'timer_failed', status: 500 })
    expect(timerError('constructor')).toEqual({ error: 'timer_failed', status: 500 })
  })
})
