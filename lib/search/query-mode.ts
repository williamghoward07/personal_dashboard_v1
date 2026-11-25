// Which of the home query box's modes a query runs in. Pure and
// browser-safe: "Auto" is decided here, locally, at zero cost, so a query
// only ever pays for the one AI path it actually needs.
//
//   find    — keyword search across modules (one fast-tier call)
//   ask     — search, then answer the question from the results
//   capture — brain-dump extraction into drafts you confirm one by one

export type QueryMode = 'auto' | 'find' | 'ask' | 'capture'
export type ResolvedQueryMode = Exclude<QueryMode, 'auto'>

const QUESTION_WORDS = ['how', 'what', 'when', 'where', 'why', 'who', 'which', 'is', 'are', 'does', 'do', 'did', 'can', 'should', 'was', 'were']
// "do the laundry" is a command, not a question.
const COMMAND_BLOCKING_QUESTION_WORDS = QUESTION_WORDS.filter((w) => w !== 'do')

const POLITE_PREFIX = /^(please|pls|can you|could you|would you)\s+/
const ACTION_PREFIXES = [
  'add',
  'create',
  'new',
  'remind me',
  'log',
  'schedule',
  'book',
  'buy',
  'email',
  'call',
  'text',
  'message',
  'finish',
  'submit',
  'pay',
  'met',
  'todo',
  'to do',
  'need to',
  'i need to',
  'i have to',
  'have to',
  "don't forget",
  'dont forget',
  'remember to',
  'must',
  'gotta',
  'note',
  'reply',
  'send',
  'pick up',
  'order',
  'cancel',
  'renew',
  'print',
  'revise',
  'read',
]
// Weekdays only count as a date when preceded by a preposition-ish word or
// when they end the query ("dentist friday"), so "sunday service notes"
// still searches. The trailing form skips the short forms that are also
// ordinary words ("the sun", "sat"), which would otherwise turn a search
// into a capture.
const WEEKDAY = '(mon(day)?|tue(s|sday)?|wed(s|nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)'
const TRAILING_WEEKDAY = '(monday|tue(s|sday)?|wed(s|nesday)|thu(r|rs|rsday)?|fri(day)?|saturday|sunday)'
const DATE_HINT = new RegExp(
  [
    '\\b(due|today|tomorrow|tonight|next week|next month|this (morning|afternoon|evening))\\b',
    '\\b\\d{1,2}(:\\d{2})?\\s?(am|pm)\\b',
    '\\bin \\d+ (day|days|week|weeks)\\b',
    `\\b(on|by|this|next|before|until|till) ${WEEKDAY}\\b`,
    `\\s${TRAILING_WEEKDAY}$`,
  ].join('|'),
)

function firstWord(text: string): string {
  return text.split(/\s+/)[0] ?? ''
}

/** Reads as a question about the user's own data. */
export function isQuestion(query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return false
  if (trimmed.endsWith('?')) return true
  return QUESTION_WORDS.includes(firstWord(trimmed))
}

/** Reads as an instruction to add/log something. */
export function looksLikeCommand(query: string): boolean {
  const trimmed = query.trim().toLowerCase().replace(POLITE_PREFIX, '')
  if (!trimmed) return false
  if (ACTION_PREFIXES.some((verb) => trimmed === verb || trimmed.startsWith(`${verb} `))) return true
  if (COMMAND_BLOCKING_QUESTION_WORDS.includes(firstWord(trimmed))) return false
  return DATE_HINT.test(trimmed)
}

export function resolveQueryMode(mode: QueryMode, query: string): ResolvedQueryMode {
  if (mode !== 'auto') return mode
  const trimmed = query.trim()
  if (trimmed.endsWith('?')) return 'ask'
  // Several lines or clauses is a brain dump, not a search.
  if (/[\n;]/.test(trimmed) || looksLikeCommand(trimmed)) return 'capture'
  if (isQuestion(trimmed)) return 'ask'
  return 'find'
}
