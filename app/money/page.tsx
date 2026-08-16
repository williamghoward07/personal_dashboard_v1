import PageContainer from '../components/PageContainer'
import MoneyBoard from '../components/widgets/MoneyBoard'

export default function MoneyPage() {
  return (
    <PageContainer title="Money" subtitle="Balances and spending across every account." accent="blue">
      <MoneyBoard />
    </PageContainer>
  )
}
