'use client'

import { buildDateGrid, monthLabelsForGrid, HEATMAP_DAY_LABELS } from '@/lib/habits/heatmap'

export type HabitDayStatus = 'met' | 'partial'

export default function HabitHeatmap({
  statusByDate,
  colour,
  onCellClick,
}: {
  statusByDate: Map<string, HabitDayStatus>
  colour: string
  onCellClick: (date: string) => void
}) {
  const grid = buildDateGrid()
  const monthLabels = monthLabelsForGrid(grid)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-0.75 pl-4">
        {monthLabels.map((label, wi) => (
          <span key={wi} className="flex-1 text-[9px] leading-none text-on-surface-variant">
            {label}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <div className="flex shrink-0 flex-col justify-between gap-0.75 text-[8px] leading-none text-on-surface-variant">
          {HEATMAP_DAY_LABELS.map((label, i) => (
            <span key={label} className={i % 2 === 0 ? undefined : 'invisible'}>
              {label[0]}
            </span>
          ))}
        </div>
        <div className="flex flex-1 gap-0.75">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-1 flex-col gap-0.75">
              {week.map((cell) => {
                const status = statusByDate.get(cell.date)
                const bg =
                  status === 'met' ? colour : status === 'partial' ? `${colour}80` : `${colour}1f`
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={cell.isFuture}
                    onClick={() => onCellClick(cell.date)}
                    title={cell.isFuture ? undefined : cell.date}
                    aria-label={cell.isFuture ? undefined : `${cell.date}: ${status ?? 'not done'}`}
                    className={`aspect-square w-full rounded-[3px] transition-transform ${
                      cell.isFuture
                        ? 'cursor-default border border-dashed border-outline-variant/30'
                        : 'cursor-pointer hover:scale-110 hover:ring-1 hover:ring-on-surface/30'
                    }`}
                    style={{ backgroundColor: cell.isFuture ? 'transparent' : bg }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
