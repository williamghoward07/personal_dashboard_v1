import AccountDetailBoard from '@/app/components/widgets/money/AccountDetailBoard'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = await params
  return <AccountDetailBoard accountId={accountId} />
}
