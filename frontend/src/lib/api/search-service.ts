import { HttpClient } from './http-client'

export type SearchTab = 'people' | 'companies'

export type StagedFilters = {
  industries: number[]
  wilayas: number[]
  seniorities: string[]
  sizes: string[]
  includeUnknownSize: boolean
  keyword: string
}

export const EMPTY_FILTERS: StagedFilters = {
  industries: [],
  wilayas: [],
  seniorities: [],
  sizes: [],
  includeUnknownSize: false,
  keyword: '',
}

export function countActiveFilters(filters: StagedFilters): number {
  let count = 0
  count += filters.industries.length
  count += filters.wilayas.length
  count += filters.seniorities.length
  count += filters.sizes.length
  if (filters.keyword.trim().length > 0) count += 1
  if (filters.includeUnknownSize) count += 1
  return count
}

export function buildFiltersPayload(
  filters: StagedFilters,
  tab: SearchTab,
): Record<string, unknown> {
  if (tab === 'companies') {
    return {
      industry: filters.industries,
      wilaya: filters.wilayas,
      size: filters.sizes,
      keyword: filters.keyword,
      include_unknown_size: filters.includeUnknownSize,
    }
  }
  return {
    industry: filters.industries,
    wilaya: filters.wilayas,
    seniority: filters.seniorities,
    keyword: filters.keyword,
  }
}

export type SearchResult = {
  results: unknown[]
  total: number
  page: number
  truncated: boolean
  refine_prompt: string | null
}

export class SearchService extends HttpClient {
  async searchPeople(filtersJson: string, page = 1, sort = 'name:asc'): Promise<SearchResult> {
    const { data } = await this.client.get<SearchResult>('/api/search/people/', {
      params: { filters: filtersJson, page, sort },
    })
    return data
  }

  async searchCompanies(
    filtersJson: string,
    page = 1,
    sort = 'name:asc',
  ): Promise<SearchResult> {
    const { data } = await this.client.get<SearchResult>('/api/search/companies/', {
      params: { filters: filtersJson, page, sort },
    })
    return data
  }
}

export const searchService = new SearchService()
