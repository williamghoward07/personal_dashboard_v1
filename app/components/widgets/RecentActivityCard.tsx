import WidgetCard from '../WidgetCard'

export default function RecentActivityCard({
  title,
  activityPlaceholder,
}: {
  title: string
  activityPlaceholder: string
}) {
  return (
    <WidgetCard title={title} accent="mint">
      <div className="flex flex-col gap-1">
        <span>{activityPlaceholder}</span>
        <span className="text-xs text-on-surface-variant">X days ago</span>
      </div>
    </WidgetCard>
  )
}
