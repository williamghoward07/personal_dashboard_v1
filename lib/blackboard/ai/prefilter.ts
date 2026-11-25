// Cheap, deterministic "could this text contain a key date?" check, run
// before any extraction call. A text that fails it is marked processed with
// zero AI calls. Deliberately broad (a false positive costs one share of a
// batched call; a false negative loses a deadline), and broader than
// parseTitleDate: "due", "deadline", "next Friday", "Week 6 tutorials" all
// count. Pure.

import { parseTitleDate } from '@/lib/blackboard/dates'

const WEEKDAY = '(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?'
const WEEKDAY_FULL = '(?:mon|tues|wednes|thurs|fri|satur|sun)day'
const SESSION_WORD = '(?:tutorials?|seminars?|workshops?|practicals?|tests?|exams?|quiz(?:zes)?)'
// What a task can be "for": a session, or the next class / week.
const SESSION_NOUN = '(?:lectures?|tutorials?|seminars?|workshops?|practicals?|sessions?|class(?:es)?|labs?)'
const SPELLED_WEEK =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)'
const WEEK_NUMBER = `weeks?\\s*(?:\\d{1,2}|${SPELLED_WEEK})`

const SIGNALS: RegExp[] = [
  // "next Friday", "by Monday", "on Tuesday", "for Thursday", "ahead of Wed"
  new RegExp(`\\b(?:next|this|by|on|until|before|from|every|for|to|ahead\\s+of)\\s+${WEEKDAY}\\b`, 'i'),
  // "Tuesday's seminar", "Thursday’s practical"
  new RegExp(`\\b${WEEKDAY_FULL}(?:'|’)s\\b`, 'i'),
  // "the next workshop", "next session", "next class"
  new RegExp(`\\bnext\\s+(?:${SESSION_NOUN}|week)\\b`, 'i'),
  // "before the next workshop", "ahead of the seminar", "in preparation for your tutorial"
  new RegExp(
    `\\b(?:before|ahead\\s+of|in\\s+advance\\s+of|in\\s+preparation\\s+for)\\s+(?:the\\s+|your\\s+|our\\s+|this\\s+|next\\s+|each\\s+)?${SESSION_NOUN}\\b`,
    'i'
  ),
  /\b(?:due|deadlines?|overdue)\b/i,
  /\bsubmi(?:t|ts|tted|tting|ssions?)\b/i,
  /\bhand(?:ed|ing)?[\s-]+in\b/i,
  // "by 2pm", "by 14:00", "by noon", "by midnight"
  /\bby\s+(?:\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b|\d{1,2}[:.]\d{2}\b|noon\b|midday\b|midnight\b)/i,
  /\b(?:tomorrow|tonight)\b/i,
  /\b(?:next|this|following|coming)\s+week\b/i,
  // "Week 6 tutorials", "tutorial in week 3", "tutorial in week fourteen"
  new RegExp(`\\b${WEEK_NUMBER}\\b[^\\n]{0,40}?\\b${SESSION_WORD}`, 'i'),
  new RegExp(`\\b${SESSION_WORD}\\b[^\\n]{0,40}?\\b${WEEK_NUMBER}\\b`, 'i'),
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
