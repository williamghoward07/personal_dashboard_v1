import LoadingSkeleton from '../components/LoadingSkeleton'

export default function LoadingCalendar() {
  return (
    <main className="workspace-page">
      <LoadingSkeleton shape="calendar" label="Loading calendar" />
    </main>
  )
}
