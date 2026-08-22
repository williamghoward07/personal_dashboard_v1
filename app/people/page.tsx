import { Suspense } from 'react'
import PageContainer from '../components/PageContainer'
import PeopleBoard from '../components/widgets/people/PeopleBoard'

export default function PeoplePage() {
  return (
    <PageContainer
      title="People"
      subtitle="Contacts, conversations, and the places you met."
      accent="amber"
    >
      {/* PeopleDirectoryCard reads ?person=<id> via useSearchParams to
          deep-link a follow-up straight to that person's detail view. */}
      <Suspense fallback={null}>
        <PeopleBoard />
      </Suspense>
    </PageContainer>
  )
}
