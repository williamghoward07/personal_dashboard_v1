import PageContainer from '../components/PageContainer'
import CalendarPageView from '../components/calendar/CalendarPageView'
import { DeadlinePopoverProvider } from '../components/calendar/DeadlinePopover'
import { SessionPopoverProvider } from '../components/lectures/SessionPopover'

export default function CalendarPage() {
  return (
    <PageContainer title="Calendar">
      <SessionPopoverProvider>
        <DeadlinePopoverProvider>
          <CalendarPageView />
        </DeadlinePopoverProvider>
      </SessionPopoverProvider>
    </PageContainer>
  )
}
