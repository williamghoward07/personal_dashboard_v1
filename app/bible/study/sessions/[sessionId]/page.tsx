import SessionDetail from '@/app/components/widgets/bible/SessionDetail'

export default async function BibleSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <SessionDetail sessionId={sessionId} />
}
