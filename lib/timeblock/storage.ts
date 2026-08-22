const STORAGE_KEY = 'timeblock:wake-bedtime'

interface StoredWakeBedtime {
  wake: string
  bedtime: string
}

// Best-effort convenience prefill for the wizard's wake/bedtime inputs —
// never blocks the primary action if localStorage is unavailable (private
// browsing, quota, etc.), matching the codebase's general silent-catch
// style for non-critical persistence (e.g. pullReminders in use-todos.ts).
export function readLastWakeBedtime(): StoredWakeBedtime | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.wake !== 'string' || typeof parsed?.bedtime !== 'string') return null
    return { wake: parsed.wake, bedtime: parsed.bedtime }
  } catch {
    return null
  }
}

export function writeLastWakeBedtime(wake: string, bedtime: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wake, bedtime }))
  } catch {
    // Silent — this is a convenience prefill, not a critical write.
  }
}
