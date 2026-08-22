// Fisher-Yates, pure copy — the input array is never mutated. rng is
// injectable so tests can pass a seeded generator for deterministic
// assertions; production callers omit it and get Math.random.
export function shuffleItems<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
