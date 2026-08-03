import PageContainer from '../components/PageContainer'
import PromptLibrary from '../components/widgets/prompts/PromptLibrary'
import PerplexityStore from '../components/widgets/perplexity/PerplexityStore'

export default function ResearchPage() {
  return (
    <PageContainer title="Research">
      <PromptLibrary />
      <PerplexityStore />
    </PageContainer>
  )
}
