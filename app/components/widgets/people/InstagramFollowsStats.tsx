import { Users, Link2, CircleDashed } from 'lucide-react'
import { ModuleGlassCard } from '@/components/ui/module-glass-card'
import { ProgressRing } from '@/components/ui/progress-ring'

function CountTile({ label, value, Icon }: { label: string; value: number; Icon: typeof Users }) {
  return (
    <ModuleGlassCard accent="amber" size="sm" className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">{label}</span>
        <span className="font-mono text-headline-lg font-bold tabular-nums text-on-surface">{value}</span>
      </div>
      <Icon className="h-5 w-5 shrink-0 text-people-amber/70" strokeWidth={1.75} />
    </ModuleGlassCard>
  )
}

export default function InstagramFollowsStats({ total, linked, unlinked }: { total: number; linked: number; unlinked: number }) {
  const linkRate = total === 0 ? 0 : Math.round((linked / total) * 100)

  return (
    <div className="grid grid-cols-3 gap-2">
      <CountTile label="Total follows" value={total} Icon={Users} />
      <ModuleGlassCard accent="amber" size="sm" className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Linked</span>
          <span className="font-mono text-headline-lg font-bold tabular-nums text-on-surface">{linked}</span>
          <span className="text-[10px] text-on-surface-variant">{linkRate}% of follows</span>
        </div>
        <div title={`${linkRate}% linked to a contact`}>
          <ProgressRing
            accent="amber"
            value={linkRate}
            size="sm"
            showValue
            formatValue={() => <Link2 className="h-3.5 w-3.5 text-people-amber" strokeWidth={1.75} />}
          />
        </div>
      </ModuleGlassCard>
      <CountTile label="Unlinked" value={unlinked} Icon={CircleDashed} />
    </div>
  )
}
