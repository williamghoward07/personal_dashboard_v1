import WidgetCard from '../WidgetCard'

export default function RecentActivityCard({
  title,
  activityPlaceholder,
}: {
  title: string
  activityPlaceholder: string
}) {
  return (
    <WidgetCard title={title}>
      <div className="flex flex-col gap-1">
        <span>{activityPlaceholder}</span>
        <span className="text-xs text-black/30 dark:text-white/30">
          X days ago
        </span>
      </div>
    </WidgetCard>
  )
}
