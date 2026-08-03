import PageContainer from '../components/PageContainer'
import WidgetCard from '../components/WidgetCard'
import SpendingBreakdownChart from '../components/widgets/SpendingBreakdownChart'
import NetBalanceCard from '../components/widgets/NetBalanceCard'
import TradingProfileCard from '../components/widgets/TradingProfileCard'

export default function MoneyPage() {
  return (
    <PageContainer title="Money">
      <WidgetCard title="Balances">
        Monzo/Starling balances will live here.
      </WidgetCard>
      <NetBalanceCard />
      <TradingProfileCard />
      <SpendingBreakdownChart />
    </PageContainer>
  )
}
