import PageContainer from '../components/PageContainer'
import StravaWeeklyWidget from '../components/widgets/StravaWeeklyWidget'
import RecentActivityCard from '../components/widgets/RecentActivityCard'
import RugbySessionsCard from '../components/widgets/rugby/RugbySessionsCard'

export default function HealthPage() {
  return (
    <PageContainer title="Health" subtitle="Physiological load — running, lifting, rugby." accent="mint">
      <StravaWeeklyWidget />
      <RecentActivityCard
        title="Most recent run"
        activityPlaceholder="Run placeholder — distance, pace, time"
      />
      <RecentActivityCard
        title="Most recent strength workout"
        activityPlaceholder="Strength placeholder — session summary"
      />
      <RugbySessionsCard />
    </PageContainer>
  )
}
