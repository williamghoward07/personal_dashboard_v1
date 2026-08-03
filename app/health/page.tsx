import PageContainer from '../components/PageContainer'
import WidgetCard from '../components/WidgetCard'
import StravaWeeklyWidget from '../components/widgets/StravaWeeklyWidget'
import RecentActivityCard from '../components/widgets/RecentActivityCard'

export default function HealthPage() {
  return (
    <PageContainer title="Health">
      <StravaWeeklyWidget />
      <RecentActivityCard
        title="Most recent run"
        activityPlaceholder="Run placeholder — distance, pace, time"
      />
      <RecentActivityCard
        title="Most recent strength workout"
        activityPlaceholder="Strength placeholder — session summary"
      />
      <WidgetCard title="Rugby sessions">
        Manually logged rugby sessions will live here.
      </WidgetCard>
    </PageContainer>
  )
}
