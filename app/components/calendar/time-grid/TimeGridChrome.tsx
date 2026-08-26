import { GRID_HEIGHT_PX, GUTTER_PX, HOURS, minutesToPx } from './grid-math'

// The left-hand hour-label gutter — rendered once per grid (day view: one
// column; week view: once, to the left of all seven day columns).
export function TimeGridHourLabels() {
  return (
    <div className="relative shrink-0" style={{ width: GUTTER_PX, height: GRID_HEIGHT_PX }}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute right-1.5 -translate-y-1/2 text-[10px] text-on-surface-variant"
          style={{ top: minutesToPx(h * 60) }}
        >
          {String(h).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  )
}

// Horizontal hour gridlines spanning a day column's full width — purely
// decorative, laid under the timed pills and current-time line.
export function TimeGridLines() {
  return (
    <>
      {HOURS.map((h) => (
        <div
          key={h}
          className="pointer-events-none absolute left-0 right-0 border-t border-outline-variant/30"
          style={{ top: minutesToPx(h * 60) }}
        />
      ))}
    </>
  )
}
