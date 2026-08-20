// Canonical 66-book list, in Bible order. Mirrors the `book` CHECK
// constraint and the book_order CASE in get_or_create_bible_passage()
// (supabase/migrations/20260822000100_bible_functions.sql) exactly — this
// is the client-side copy of that same single source of truth, used for
// input validation and for sorting passages/notes client-side without a
// round trip when book_order isn't already on hand.
export type Testament = 'old' | 'new'

export interface BibleBook {
  name: string
  order: number
  testament: Testament
}

export const BIBLE_BOOKS: BibleBook[] = [
  { name: 'Genesis', order: 1, testament: 'old' },
  { name: 'Exodus', order: 2, testament: 'old' },
  { name: 'Leviticus', order: 3, testament: 'old' },
  { name: 'Numbers', order: 4, testament: 'old' },
  { name: 'Deuteronomy', order: 5, testament: 'old' },
  { name: 'Joshua', order: 6, testament: 'old' },
  { name: 'Judges', order: 7, testament: 'old' },
  { name: 'Ruth', order: 8, testament: 'old' },
  { name: '1 Samuel', order: 9, testament: 'old' },
  { name: '2 Samuel', order: 10, testament: 'old' },
  { name: '1 Kings', order: 11, testament: 'old' },
  { name: '2 Kings', order: 12, testament: 'old' },
  { name: '1 Chronicles', order: 13, testament: 'old' },
  { name: '2 Chronicles', order: 14, testament: 'old' },
  { name: 'Ezra', order: 15, testament: 'old' },
  { name: 'Nehemiah', order: 16, testament: 'old' },
  { name: 'Esther', order: 17, testament: 'old' },
  { name: 'Job', order: 18, testament: 'old' },
  { name: 'Psalms', order: 19, testament: 'old' },
  { name: 'Proverbs', order: 20, testament: 'old' },
  { name: 'Ecclesiastes', order: 21, testament: 'old' },
  { name: 'Song of Solomon', order: 22, testament: 'old' },
  { name: 'Isaiah', order: 23, testament: 'old' },
  { name: 'Jeremiah', order: 24, testament: 'old' },
  { name: 'Lamentations', order: 25, testament: 'old' },
  { name: 'Ezekiel', order: 26, testament: 'old' },
  { name: 'Daniel', order: 27, testament: 'old' },
  { name: 'Hosea', order: 28, testament: 'old' },
  { name: 'Joel', order: 29, testament: 'old' },
  { name: 'Amos', order: 30, testament: 'old' },
  { name: 'Obadiah', order: 31, testament: 'old' },
  { name: 'Jonah', order: 32, testament: 'old' },
  { name: 'Micah', order: 33, testament: 'old' },
  { name: 'Nahum', order: 34, testament: 'old' },
  { name: 'Habakkuk', order: 35, testament: 'old' },
  { name: 'Zephaniah', order: 36, testament: 'old' },
  { name: 'Haggai', order: 37, testament: 'old' },
  { name: 'Zechariah', order: 38, testament: 'old' },
  { name: 'Malachi', order: 39, testament: 'old' },
  { name: 'Matthew', order: 40, testament: 'new' },
  { name: 'Mark', order: 41, testament: 'new' },
  { name: 'Luke', order: 42, testament: 'new' },
  { name: 'John', order: 43, testament: 'new' },
  { name: 'Acts', order: 44, testament: 'new' },
  { name: 'Romans', order: 45, testament: 'new' },
  { name: '1 Corinthians', order: 46, testament: 'new' },
  { name: '2 Corinthians', order: 47, testament: 'new' },
  { name: 'Galatians', order: 48, testament: 'new' },
  { name: 'Ephesians', order: 49, testament: 'new' },
  { name: 'Philippians', order: 50, testament: 'new' },
  { name: 'Colossians', order: 51, testament: 'new' },
  { name: '1 Thessalonians', order: 52, testament: 'new' },
  { name: '2 Thessalonians', order: 53, testament: 'new' },
  { name: '1 Timothy', order: 54, testament: 'new' },
  { name: '2 Timothy', order: 55, testament: 'new' },
  { name: 'Titus', order: 56, testament: 'new' },
  { name: 'Philemon', order: 57, testament: 'new' },
  { name: 'Hebrews', order: 58, testament: 'new' },
  { name: 'James', order: 59, testament: 'new' },
  { name: '1 Peter', order: 60, testament: 'new' },
  { name: '2 Peter', order: 61, testament: 'new' },
  { name: '1 John', order: 62, testament: 'new' },
  { name: '2 John', order: 63, testament: 'new' },
  { name: '3 John', order: 64, testament: 'new' },
  { name: 'Jude', order: 65, testament: 'new' },
  { name: 'Revelation', order: 66, testament: 'new' },
]

const BOOK_NAMES = new Set(BIBLE_BOOKS.map((b) => b.name))

export function isValidBookName(name: string): boolean {
  return BOOK_NAMES.has(name)
}

export function bookOrderOf(name: string): number | null {
  return BIBLE_BOOKS.find((b) => b.name === name)?.order ?? null
}
