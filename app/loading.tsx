import LoadingSkeleton from './components/LoadingSkeleton'

export default function Loading() {
  return (
    <main className="workspace-page">
      <LoadingSkeleton shape="cards" label="Loading page…" />
    </main>
  )
}
