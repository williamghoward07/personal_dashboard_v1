import CalendarPageView from '../components/calendar/CalendarPageView'
import { SessionPopoverProvider } from '../components/lectures/SessionPopover'

// No page heading, unlike other PageContainer pages: the breadcrumb already
// says Calendar and the card's header shows the date range, so the grid
// gets that height instead (it fills the window, as Google Calendar does).
export default function CalendarPage() {
  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col px-8 py-6">
      <SessionPopoverProvider>
        <CalendarPageView />
      </SessionPopoverProvider>
    </main>
  )
}
