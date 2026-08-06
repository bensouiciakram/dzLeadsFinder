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

export type PeopleResultRow = {
  id: string
  name: string
  role: string | null
  company_name: string | null
  company_id: string | null
  wilaya_code: number | null
  wilaya_name: string | null
  revealed: boolean
}

export type CompanyResultRow = {
  id: string
  name: string
  industry: string | null
  industry_id: number | null
  wilaya_code: number | null
  wilaya_name: string | null
  size_band: string | null
  people_count: number
}

export type SearchResult<T> = {
  results: T[]
  total: number
  page: number
  truncated: boolean
  refine_prompt: string | null
}

export type SearchApiError = {
  response?: {
    status?: number
    data?: { detail?: string }
  }
}

export function isRateLimitError(
  error: unknown,
): error is SearchApiError & { response: { status: 429 } } {
  if (typeof error !== 'object' || error === null) return false
  return (error as SearchApiError).response?.status === 429
}

export class SearchService extends HttpClient {
  async searchPeople(
    filtersJson: string,
    page = 1,
    sort = 'name:asc',
    signal?: AbortSignal,
  ): Promise<SearchResult<PeopleResultRow>> {
    const { data } = await this.client.get<SearchResult<PeopleResultRow>>(
      '/search/people/',
      { params: { filters: filtersJson, page, sort }, signal },
    )
    return data
  }

  async searchCompanies(
    filtersJson: string,
    page = 1,
    sort = 'name:asc',
    signal?: AbortSignal,
  ): Promise<SearchResult<CompanyResultRow>> {
    const { data } = await this.client.get<SearchResult<CompanyResultRow>>(
      '/search/companies/',
      { params: { filters: filtersJson, page, sort }, signal },
    )
    return data
  }
}

export const searchService = new SearchService()
