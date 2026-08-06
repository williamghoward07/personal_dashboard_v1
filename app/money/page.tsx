import PageContainer from '../components/PageContainer'
import TradingProfileCard from '../components/widgets/TradingProfileCard'
import MoneyBoard from '../components/widgets/MoneyBoard'

export default function MoneyPage() {
  return (
    <PageContainer title="Money" subtitle="Liquidity, spend, and portfolio tracking." accent="blue">
      <TradingProfileCard />
      <MoneyBoard />
    </PageContainer>
  )
}
