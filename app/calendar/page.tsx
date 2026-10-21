import PageContainer from '../components/PageContainer'
import CalendarPageView from '../components/calendar/CalendarPageView'
import { SessionPopoverProvider } from '../components/lectures/SessionPopover'

export default function CalendarPage() {
  return (
    <PageContainer title="Calendar">
      <SessionPopoverProvider>
        <CalendarPageView />
      </SessionPopoverProvider>
    </PageContainer>
  )
}
