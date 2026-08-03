import WidgetCard from '../WidgetCard'

export default function TradingProfileCard() {
  return (
    <WidgetCard title="Trading 212">
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-semibold">£4,820.15</span>
        <span className="text-xs text-[#006300] dark:text-[#0ca30c]">
          +£62.10 (1.3%) today
        </span>
        <span className="text-xs text-black/30 dark:text-white/30">
          Trading 212 portfolio placeholder
        </span>
      </div>
    </WidgetCard>
  )
}
