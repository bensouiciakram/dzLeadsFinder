import type { SearchTab } from '@/lib/api/search-service'

export const searchKeys = {
  all: ['search'] as const,
  idle: ['search', 'idle'] as const,
  tab: (tab: SearchTab) => ['search', tab] as const,
  results: (
    tab: SearchTab,
    filtersJson: string,
    page: number,
    sort: string,
    nonce: number,
  ) => ['search', tab, filtersJson, page, sort, nonce] as const,
}
