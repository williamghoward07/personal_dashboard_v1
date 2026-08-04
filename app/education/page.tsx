import PageContainer from '../components/PageContainer'
import AcademicBoard from '../components/widgets/academic/AcademicBoard'

export default function EducationPage() {
  return (
    <PageContainer title="Education" subtitle="Years, modules, tasks, and topics." accent="orange">
      <AcademicBoard />
    </PageContainer>
  )
}
