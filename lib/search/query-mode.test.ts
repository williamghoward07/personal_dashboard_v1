import { describe, expect, it } from 'vitest'
import { isQuestion, looksLikeCommand, resolveQueryMode } from './query-mode'

describe('resolveQueryMode (auto)', () => {
  const auto = (q: string) => resolveQueryMode('auto', q)

  it('answers questions', () => {
    expect(auto('how much did I spend on food')).toBe('ask')
    expect(auto('who did I meet at church?')).toBe('ask')
    expect(auto('is my essay due tomorrow')).toBe('ask')
    expect(auto('can you add milk?')).toBe('ask')
  })

  it('captures commands, including polite ones', () => {
    expect(auto('add essay plan due friday')).toBe('capture')
    expect(auto('remind me to call mum')).toBe('capture')
    expect(auto('please book the dentist')).toBe('capture')
    expect(auto('can you add milk to my list')).toBe('capture')
    expect(auto('met Sam at church, he studies law')).toBe('capture')
  })

  it('captures dated notes and multi-line dumps', () => {
    expect(auto('do laundry tomorrow')).toBe('capture')
    expect(auto('dentist 3pm')).toBe('capture')
    expect(auto('essay plan\ncall mum')).toBe('capture')
    expect(auto('essay plan; call mum')).toBe('capture')
  })

  it('searches everything else', () => {
    expect(auto('Sam')).toBe('find')
    expect(auto('todos')).toBe('find')
    expect(auto('geography dissertation')).toBe('find')
    // "new" only counts as a whole word
    expect(auto('newcastle trip')).toBe('find')
  })

  it('never second-guesses an explicit mode', () => {
    expect(resolveQueryMode('find', 'add milk')).toBe('find')
    expect(resolveQueryMode('ask', 'Sam')).toBe('ask')
    expect(resolveQueryMode('capture', 'what is this?')).toBe('capture')
  })
})

describe('heuristics', () => {
  it('isQuestion', () => {
    expect(isQuestion('what is due')).toBe(true)
    expect(isQuestion('essay?')).toBe(true)
    expect(isQuestion('essay')).toBe(false)
    expect(isQuestion('   ')).toBe(false)
  })

  it('looksLikeCommand', () => {
    expect(looksLikeCommand('add')).toBe(true)
    expect(looksLikeCommand('when is it due')).toBe(false)
    expect(looksLikeCommand('')).toBe(false)
  })
})
