import Link from 'next/link'
import { FileUp } from 'lucide-react'
import PageContainer from '../components/PageContainer'
import HealthRingsCard from '../components/widgets/health/HealthRingsCard'
import ActivitySessionsCard from '../components/widgets/health/ActivitySessionsCard'

export default function HealthPage() {
  return (
    <PageContainer title="Health" subtitle="Physiological load — running, lifting, and everything else." accent="mint">
      <HealthRingsCard />
      <ActivitySessionsCard />
      <Link
        href="/health/import"
        className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant text-sm font-medium text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary-container sm:col-span-2 xl:col-span-4"
      >
        <FileUp className="h-5 w-5" />
        Import Strava data
      </Link>
    </PageContainer>
  )
}
