import WidgetCard from '../WidgetCard'

export default function NetBalanceCard() {
  return (
    <WidgetCard title="Net balance change">
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-semibold text-[#006300] dark:text-[#0ca30c]">
          +£248.50
        </span>
        <span className="text-xs text-black/30 dark:text-white/30">
          vs last month
        </span>
      </div>
    </WidgetCard>
  )
}
