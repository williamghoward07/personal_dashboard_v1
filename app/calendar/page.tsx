import CalendarPageView from '../components/calendar/CalendarPageView'
import { DeadlinePopoverProvider } from '../components/calendar/DeadlinePopover'
import { SessionPopoverProvider } from '../components/lectures/SessionPopover'

// No page heading, unlike other PageContainer pages: the breadcrumb already
// says Calendar and the card's header shows the date range, so the grid
// gets that height instead (it fills the window, as Google Calendar does).
export default function CalendarPage() {
  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col px-3 pt-3 pb-6 sm:px-5 lg:px-8">
      <SessionPopoverProvider>
        <DeadlinePopoverProvider>
          <CalendarPageView />
        </DeadlinePopoverProvider>
      </SessionPopoverProvider>
    </main>
  )
}
