import { describe, expect, it } from 'vitest'
import { canSkipAi, localExtraction, localFastPath, tokeniseQuery } from './local-query'

describe('tokeniseQuery', () => {
  it('drops stopwords and short tokens, lower-cases', () => {
    expect(tokeniseQuery('The Essay on Rivers')).toEqual(['essay', 'river'])
    expect(tokeniseQuery('a x Sam')).toEqual(['sam'])
  })
  it('singularises naively', () => {
    expect(tokeniseQuery('essays')).toEqual(['essay'])
    expect(tokeniseQuery('glass')).toEqual(['glass'])
    expect(tokeniseQuery('bus')).toEqual(['bus'])
  })
  it('splits punctuation, dedupes and caps at 5', () => {
    expect(tokeniseQuery('food, food; Food!')).toEqual(['food'])
    expect(tokeniseQuery('aa bb cc dd ee ff gg')).toHaveLength(5)
  })
  it('returns nothing for stopword-only input', () => {
    expect(tokeniseQuery('show me all of the')).toEqual([])
  })
})

describe('localFastPath', () => {
  it('bare module word browses', () => {
    expect(localFastPath('todos')).toEqual({ keywords: [], targetModules: ['todos'], timeWindow: null })
  })
  it('leading module word + rest', () => {
    expect(localFastPath('money spent on food')).toEqual({ keywords: ['food'], targetModules: ['transactions'], timeWindow: null })
  })
  it('drops question words when a whole question is tokenised (AI fallback)', () => {
    expect(localExtraction('how much did I spend on food this month')).toEqual({
      keywords: ['food'],
      targetModules: [],
      timeWindow: 'this_month',
    })
    expect(tokeniseQuery('who did I meet at church')).toEqual(['meet', 'church'])
  })
  it('strips a time window before the module fast path', () => {
    expect(localFastPath('money spent on food this month')).toEqual({
      keywords: ['food'],
      targetModules: ['transactions'],
      timeWindow: 'this_month',
    })
    expect(localFastPath('todos this week')).toEqual({ keywords: [], targetModules: ['todos'], timeWindow: 'this_week' })
  })
  it('a query that is only a time window has no keywords or modules', () => {
    expect(localFastPath('this week')).toEqual({ keywords: [], targetModules: [], timeWindow: 'this_week' })
  })
  it('does not apply otherwise', () => {
    expect(localFastPath('Sam')).toBeNull()
    expect(localFastPath('  ')).toBeNull()
  })
})

describe('localExtraction', () => {
  it('uses the fast path when it applies', () => {
    expect(localExtraction('habits').targetModules).toEqual(['habits'])
  })
  it('keeps time words out of the keywords', () => {
    expect(localExtraction('food last month')).toEqual({ keywords: ['food'], targetModules: [], timeWindow: 'last_month' })
  })
  it('drops "due" as a stopword', () => {
    expect(localExtraction('essay due')).toEqual({ keywords: ['essay'], targetModules: [], timeWindow: null })
  })
  it('otherwise tokenises with no modules', () => {
    expect(localExtraction('geography dissertation')).toEqual({ keywords: ['geography', 'dissertation'], targetModules: [], timeWindow: null })
  })
})

describe('canSkipAi', () => {
  it('skips short plain queries', () => {
    expect(canSkipAi('Sam')).toBe(true)
    expect(canSkipAi('geography dissertation')).toBe(true)
    expect(canSkipAi('tesco')).toBe(true)
    expect(canSkipAi('food last month')).toBe(true)
    expect(canSkipAi('this week')).toBe(true)
    expect(canSkipAi('geography essay last week')).toBe(true)
  })
  it('keeps the AI for questions, long queries and digits', () => {
    expect(canSkipAi('what did I spend')).toBe(false)
    expect(canSkipAi('anything?')).toBe(false)
    expect(canSkipAi('essay plan for geography lecture')).toBe(false)
    expect(canSkipAi('essay 2')).toBe(false)
    expect(canSkipAi('')).toBe(false)
  })
})
