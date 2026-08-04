import PageContainer from '../components/PageContainer'
import WidgetCard from '../components/WidgetCard'
import TradingProfileCard from '../components/widgets/TradingProfileCard'
import MoneyBoard from '../components/widgets/MoneyBoard'

export default function MoneyPage() {
  return (
    <PageContainer title="Money" subtitle="Liquidity, spend, and portfolio tracking." accent="blue">
      <WidgetCard title="Balances" accent="blue">
        Monzo/Starling balances will live here.
      </WidgetCard>
      <TradingProfileCard />
      <MoneyBoard />
    </PageContainer>
  )
}
