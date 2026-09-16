import WorkspaceDetailBoard from '../../components/widgets/workspaces/WorkspaceDetailBoard'

export default async function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkspaceDetailBoard workspaceId={id} />
}
