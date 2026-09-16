import WorkspacesBoard from '../components/widgets/workspaces/WorkspacesBoard'

// ?folder=<id> opens a folder; no param = the top level.
export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { folder } = await searchParams
  const folderId = typeof folder === 'string' && folder ? folder : null
  return <WorkspacesBoard folderId={folderId} />
}
