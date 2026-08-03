export type HabitDayStatus = 'met' | 'partial'

const WEEKS = 14
const DAYS = 7

function buildDateGrid(): string[][] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const total = WEEKS * DAYS
  const dates: string[] = []
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  const grid: string[][] = []
  for (let w = 0; w < WEEKS; w++) {
    grid.push(dates.slice(w * DAYS, w * DAYS + DAYS))
  }
  return grid
}

export default function HabitHeatmap({
  statusByDate,
  color,
}: {
  statusByDate: Map<string, HabitDayStatus>
  color: string
}) {
  const grid = buildDateGrid()

  return (
    <div className="flex gap-0.75">
      {grid.map((week, wi) => (
        <div key={wi} className="flex flex-1 flex-col gap-0.75">
          {week.map((date) => {
            const status = statusByDate.get(date)
            const bg =
              status === 'met' ? color : status === 'partial' ? `${color}80` : `${color}1f`
            return (
              <div
                key={date}
                title={date}
                className="aspect-square w-full rounded-[3px]"
                style={{ backgroundColor: bg }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
