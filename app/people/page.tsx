import PageContainer from '../components/PageContainer'
import PeopleBoard from '../components/widgets/people/PeopleBoard'

export default function PeoplePage() {
  return (
    <PageContainer
      title="People"
      subtitle="Contacts, conversations, and the places you met."
      accent="amber"
    >
      <PeopleBoard />
    </PageContainer>
  )
}
