import type { SearchModule } from './nl-search'

export interface SearchResultItem {
  module: SearchModule
  id: string
  title: string
  subtitle: string | null
}
