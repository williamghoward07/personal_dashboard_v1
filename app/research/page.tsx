import PageContainer from '../components/PageContainer'
import PromptLibrary from '../components/widgets/prompts/PromptLibrary'
import PerplexityStore from '../components/widgets/perplexity/PerplexityStore'

export default function ResearchPage() {
  return (
    <PageContainer title="Research" subtitle="Prompt library and saved Perplexity chats." accent="pink">
      <PromptLibrary />
      <PerplexityStore />
    </PageContainer>
  )
}
