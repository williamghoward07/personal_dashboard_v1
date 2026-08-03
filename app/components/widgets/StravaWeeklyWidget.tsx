import WidgetCard from '../WidgetCard'

export default function StravaWeeklyWidget() {
  return (
    <WidgetCard title="This week" className="sm:col-span-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-black/30 dark:text-white/30">
            Running
          </span>
          <span>Weekly distance placeholder</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-black/30 dark:text-white/30">
            Strength
          </span>
          <span>Weekly sessions placeholder</span>
        </div>
      </div>
    </WidgetCard>
  )
}
