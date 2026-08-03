const WEEKS = 14
const DAYS = 7

// Deterministic (seeded) pseudo-random so server and client render identically.
function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export default function HabitHeatmap({
  seed,
  fillRate,
  color,
}: {
  seed: number
  fillRate: number
  color: string
}) {
  const weeks = Array.from({ length: WEEKS }, (_, week) =>
    Array.from(
      { length: DAYS },
      (_, day) => seededRandom(seed * 9973 + week * DAYS + day) < fillRate,
    ),
  )

  return (
    <div className="flex gap-0.75">
      {weeks.map((days, week) => (
        <div key={week} className="flex flex-1 flex-col gap-0.75">
          {days.map((filled, day) => (
            <div
              key={day}
              className="aspect-square w-full rounded-[3px]"
              style={{ backgroundColor: filled ? color : `${color}1f` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
