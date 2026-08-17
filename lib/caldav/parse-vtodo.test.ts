import { describe, it, expect } from 'vitest'
import { parseVTodos, setVTodoCompletion } from './parse-vtodo'

const FALLBACK_NOW = '2026-08-17T12:00:00.000Z'

function wrap(vtodo: string): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Apple Inc.//iOS 17.0//EN', vtodo, 'END:VCALENDAR'].join('\n')
}

describe('parseVTodos', () => {
  it('parses a basic incomplete reminder with no due date', () => {
    const ics = wrap(['BEGIN:VTODO', 'UID:abc-123', 'SUMMARY:Buy milk', 'STATUS:NEEDS-ACTION', 'END:VTODO'].join('\n'))

    const [todo] = parseVTodos(ics, FALLBACK_NOW)
    expect(todo.caldav_uid).toBe('abc-123')
    expect(todo.title).toBe('Buy milk')
    expect(todo.due_date).toBeNull()
    expect(todo.completed_at).toBeNull()
    expect(todo.notes).toBeNull()
  })

  it('parses a DATE-form DUE property', () => {
    const ics = wrap(
      ['BEGIN:VTODO', 'UID:abc-123', 'SUMMARY:Buy milk', 'DUE;VALUE=DATE:20260820', 'END:VTODO'].join('\n')
    )
    const [todo] = parseVTodos(ics, FALLBACK_NOW)
    expect(todo.due_date).toBe('2026-08-20')
  })

  it('truncates a DATE-TIME-form DUE property to just the date', () => {
    const ics = wrap(
      ['BEGIN:VTODO', 'UID:abc-123', 'SUMMARY:Buy milk', 'DUE:20260820T090000Z', 'END:VTODO'].join('\n')
    )
    const [todo] = parseVTodos(ics, FALLBACK_NOW)
    expect(todo.due_date).toBe('2026-08-20')
  })

  it('uses the explicit COMPLETED timestamp when present, not the fallback', () => {
    const ics = wrap(
      [
        'BEGIN:VTODO',
        'UID:abc-123',
        'SUMMARY:Buy milk',
        'STATUS:COMPLETED',
        'COMPLETED:20260816T090000Z',
        'END:VTODO',
      ].join('\n')
    )
    const [todo] = parseVTodos(ics, FALLBACK_NOW)
    expect(todo.completed_at).toBe('2026-08-16T09:00:00Z')
  })

  it('falls back when STATUS is COMPLETED but no COMPLETED timestamp is given', () => {
    const ics = wrap(['BEGIN:VTODO', 'UID:abc-123', 'SUMMARY:Buy milk', 'STATUS:COMPLETED', 'END:VTODO'].join('\n'))
    const [todo] = parseVTodos(ics, FALLBACK_NOW)
    expect(todo.completed_at).toBe(FALLBACK_NOW)
  })

  it('maps and unescapes DESCRIPTION as notes', () => {
    const ics = wrap(
      [
        'BEGIN:VTODO',
        'UID:abc-123',
        'SUMMARY:Buy milk',
        'DESCRIPTION:Get 2 pints\\nAlso eggs\\, and bread',
        'END:VTODO',
      ].join('\n')
    )
    const [todo] = parseVTodos(ics, FALLBACK_NOW)
    expect(todo.notes).toBe('Get 2 pints\nAlso eggs, and bread')
  })

  it('unfolds a continuation line before parsing', () => {
    // The fold marker is the continuation line's own leading space, which
    // unfolding strips — the natural space between "of" and "groceries"
    // has to survive the fold on the *first* line instead, or it's lost.
    const ics = wrap(
      [
        'BEGIN:VTODO',
        'UID:abc-123',
        'SUMMARY:Buy milk and also a very long list of ',
        ' groceries for the week',
        'END:VTODO',
      ].join('\n')
    )
    const [todo] = parseVTodos(ics, FALLBACK_NOW)
    expect(todo.title).toBe('Buy milk and also a very long list of groceries for the week')
  })

  it('parses every VTODO in a multi-component blob', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VTODO',
      'UID:first',
      'SUMMARY:First',
      'END:VTODO',
      'BEGIN:VTODO',
      'UID:second',
      'SUMMARY:Second',
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\n')

    const todos = parseVTodos(ics, FALLBACK_NOW)
    expect(todos.map((t) => t.caldav_uid)).toEqual(['first', 'second'])
  })

  it('skips a VTODO with no UID', () => {
    const ics = wrap(['BEGIN:VTODO', 'SUMMARY:No uid', 'END:VTODO'].join('\n'))
    expect(parseVTodos(ics, FALLBACK_NOW)).toEqual([])
  })

  it('skips a VTODO with no SUMMARY', () => {
    const ics = wrap(['BEGIN:VTODO', 'UID:abc-123', 'END:VTODO'].join('\n'))
    expect(parseVTodos(ics, FALLBACK_NOW)).toEqual([])
  })

  it('returns an empty array for text with no VTODO at all', () => {
    expect(parseVTodos('BEGIN:VCALENDAR\nEND:VCALENDAR', FALLBACK_NOW)).toEqual([])
  })
})

describe('setVTodoCompletion', () => {
  it('marks an incomplete VTODO as completed, adding STATUS and COMPLETED', () => {
    const ics = wrap(
      ['BEGIN:VTODO', 'UID:abc-123', 'SUMMARY:Buy milk', 'STATUS:NEEDS-ACTION', 'END:VTODO'].join('\n')
    )

    const updated = setVTodoCompletion(ics, true, '2026-08-17T12:34:56.000Z')
    const [todo] = parseVTodos(updated, FALLBACK_NOW)

    expect(todo.completed_at).toBe('2026-08-17T12:34:56Z')
    expect(updated).toContain('STATUS:COMPLETED')
    expect(updated).not.toContain('STATUS:NEEDS-ACTION')
  })

  it('marks a completed VTODO as not completed, removing COMPLETED entirely', () => {
    const ics = wrap(
      [
        'BEGIN:VTODO',
        'UID:abc-123',
        'SUMMARY:Buy milk',
        'STATUS:COMPLETED',
        'COMPLETED:20260816T090000Z',
        'END:VTODO',
      ].join('\n')
    )

    const updated = setVTodoCompletion(ics, false, '2026-08-17T12:34:56.000Z')
    expect(updated).toContain('STATUS:NEEDS-ACTION')
    expect(updated).not.toContain('COMPLETED:')

    const [todo] = parseVTodos(updated, FALLBACK_NOW)
    expect(todo.completed_at).toBeNull()
  })

  it('preserves everything else in the VTODO and the surrounding VCALENDAR', () => {
    const ics = wrap(
      ['BEGIN:VTODO', 'UID:abc-123', 'SUMMARY:Buy milk', 'DUE;VALUE=DATE:20260820', 'STATUS:NEEDS-ACTION', 'END:VTODO'].join(
        '\n'
      )
    )

    const updated = setVTodoCompletion(ics, true, '2026-08-17T12:34:56.000Z')
    expect(updated).toContain('PRODID:-//Apple Inc.//iOS 17.0//EN')

    const [todo] = parseVTodos(updated, FALLBACK_NOW)
    expect(todo.title).toBe('Buy milk')
    expect(todo.due_date).toBe('2026-08-20')
  })

  it('does not duplicate STATUS when toggling twice', () => {
    const ics = wrap(['BEGIN:VTODO', 'UID:abc-123', 'SUMMARY:Buy milk', 'STATUS:NEEDS-ACTION', 'END:VTODO'].join('\n'))

    const once = setVTodoCompletion(ics, true, '2026-08-17T12:00:00.000Z')
    const twice = setVTodoCompletion(once, false, '2026-08-17T13:00:00.000Z')

    const statusCount = (twice.match(/^STATUS:/gm) ?? []).length
    expect(statusCount).toBe(1)
    expect(twice).toContain('STATUS:NEEDS-ACTION')
  })
})
