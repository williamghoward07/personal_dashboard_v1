import { Activity } from 'lucide-react'
import WidgetCard from '../WidgetCard'

export default function StravaWeeklyWidget() {
  return (
    <WidgetCard title="This week" icon={<Activity className="h-4 w-4" />} accent="mint" className="sm:col-span-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-on-surface-variant">Running</span>
          <span>Weekly distance placeholder</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-on-surface-variant">Strength</span>
          <span>Weekly sessions placeholder</span>
        </div>
      </div>
    </WidgetCard>
  )
}
