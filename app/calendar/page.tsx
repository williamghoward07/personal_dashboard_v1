import PageContainer from '../components/PageContainer'
import CalendarPageView from '../components/calendar/CalendarPageView'

export default function CalendarPage() {
  return (
    <PageContainer title="Calendar" subtitle="Google Calendar, deadlines, and rugby sessions in one view.">
      <CalendarPageView />
    </PageContainer>
  )
}
