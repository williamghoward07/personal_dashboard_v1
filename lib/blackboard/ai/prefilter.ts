// Cheap, deterministic "could this text contain a key date?" check, run
// before any extraction call. A text that fails it is marked processed with
// zero AI calls. Deliberately broad (a false positive costs one share of a
// batched call; a false negative loses a deadline), and broader than
// parseTitleDate: "due", "deadline", "next Friday", "Week 6 tutorials" all
// count. Pure.

import { parseTitleDate } from '@/lib/blackboard/dates'

const WEEKDAY = '(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?'
const SESSION_WORD = '(?:tutorials?|seminars?|workshops?|practicals?|tests?|exams?|quiz(?:zes)?)'

const SIGNALS: RegExp[] = [
  // "next Friday", "by Monday", "on Tuesday", "this Thursday's", "before Wed"
  new RegExp(`\\b(?:next|this|by|on|until|before|from|every)\\s+${WEEKDAY}\\b`, 'i'),
  /\b(?:due|deadlines?|overdue)\b/i,
  /\bsubmi(?:t|ts|tted|tting|ssions?)\b/i,
  /\bhand(?:ed|ing)?[\s-]+in\b/i,
  // "by 2pm", "by 14:00", "by noon", "by midnight"
  /\bby\s+(?:\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b|\d{1,2}[:.]\d{2}\b|noon\b|midday\b|midnight\b)/i,
  /\b(?:tomorrow|tonight)\b/i,
  /\b(?:next|this|following|coming)\s+week\b/i,
  // "Week 6 tutorials", "tutorial in week 3"
  new RegExp(`\\bweeks?\\s*\\d{1,2}\\b[^\\n]{0,40}?\\b${SESSION_WORD}`, 'i'),
  new RegExp(`\\b${SESSION_WORD}\\b[^\\n]{0,40}?\\bweeks?\\s*\\d{1,2}\\b`, 'i'),
  /\b(?:tests?|exams?|examinations?|quiz(?:zes)?|mid-?terms?)\b/i,
  /\b(?:formative|summative)\b/i,
]

/** True when `text` holds anything that could make a key date. */
export function hasDateSignal(text: string | null | undefined): boolean {
  if (!text) return false
  if (SIGNALS.some((re) => re.test(text))) return true
  // Day + month in any common UK form, numeric dates, ISO dates. The year
  // doesn't matter here, only whether a date is written at all.
  return parseTitleDate(text, { yearStart: 2000 }) !== null
}
