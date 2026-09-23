import { Link2 } from 'lucide-react'
import { StatTile } from '@/components/ui/stat-tile'

export default function InstagramFollowsStats({
  total,
  linked,
  unlinked,
}: {
  total: number
  linked: number
  unlinked: number
}) {
  const linkRate = total === 0 ? 0 : Math.round((linked / total) * 100)

  return (
    <div className="grid grid-cols-3 gap-2">
      <StatTile label="Total follows" value={total} accent="amber" />
      <StatTile
        label="Linked"
        value={linked}
        detail={`${linkRate}% of follows`}
        percent={linkRate}
        accent="amber"
        icon={<Link2 className="h-5 w-5" strokeWidth={1.75} />}
        ringTitle={`${linkRate}% linked to a contact`}
      />
      <StatTile label="Unlinked" value={unlinked} accent="amber" />
    </div>
  )
}
