import PageContainer from '../components/PageContainer'
import BrainDumpBoard from '../components/widgets/braindump/BrainDumpBoard'

export default function BrainDumpPage() {
  return (
    <PageContainer
      title="Brain Dump"
      subtitle="Type out whatever's on your mind — review and confirm each item before anything is saved."
      accent="purple"
    >
      <BrainDumpBoard />
    </PageContainer>
  )
}
