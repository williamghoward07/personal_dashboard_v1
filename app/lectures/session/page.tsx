import SessionAssignmentView from '../../components/lectures/SessionAssignmentView'

export default async function LectureSessionPage({ searchParams }: { searchParams: Promise<{ uid?: string | string[] }> }) {
  const { uid } = await searchParams
  return <SessionAssignmentView uid={(Array.isArray(uid) ? uid[0] : uid) ?? ''} />
}
