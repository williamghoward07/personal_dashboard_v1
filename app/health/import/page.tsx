import { notFound } from 'next/navigation'
import StravaImportBoard from '../../components/widgets/health/StravaImportBoard'

export default function StravaImportPage() {
  // See app/health/page.tsx — Health tab pulled from the live site, remnants kept intact.
  notFound()

  return <StravaImportBoard />
}
