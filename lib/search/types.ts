import type { SearchModule } from './local-query'

export interface SearchResultItem {
  module: SearchModule
  id: string
  title: string
  subtitle: string | null
}
