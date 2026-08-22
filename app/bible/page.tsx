import PageContainer from '../components/PageContainer'
import BibleBoard from '../components/widgets/bible/BibleBoard'

export default function BiblePage() {
  return (
    <PageContainer title="Bible" subtitle="Study sessions, topical index, and passage notes." accent="crimson">
      <BibleBoard />
    </PageContainer>
  )
}
