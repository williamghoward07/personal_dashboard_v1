import WidgetCard from '../WidgetCard'

export default function TradingProfileCard() {
  return (
    <WidgetCard title="Trading 212" accent="blue">
      <div className="flex flex-col gap-1">
        <span className="font-display text-2xl font-semibold text-on-surface">£4,820.15</span>
        <span className="text-xs text-primary-container">+£62.10 (1.3%) today</span>
        <span className="text-xs text-on-surface-variant">Trading 212 portfolio placeholder</span>
      </div>
    </WidgetCard>
  )
}
