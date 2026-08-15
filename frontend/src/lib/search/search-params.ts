import type { SortState, SortField } from '@/components/search/ResultsTable'
import type { ChipsFacet } from '@/components/search/ActiveFilterChips'
import type { SearchTab, StagedFilters } from '@/lib/api/search-service'
import { EMPTY_FILTERS, buildFiltersPayload, countActiveFilters } from '@/lib/api/search-service'
import type { SearchSubmitted } from '@/hooks/useSearchResults'

// URL-as-state serialization for the search screen (Phase 3 — H3). The
// committed search (filters, sort, page) lives in the URL so every search
// is addressable and browser back/forward restores previous searches.
// Facet params are tab-scoped: seniority belongs to people, size +
// include-unknown-size to companies.

export const SORT_FIELDS: readonly SortField[] = [
  'name',
  'role',
  'company_name',
  'wilaya_code',
  'industry',
  'size_band',
  'people_count',
]

export type ChipRemoveEvent = {
  facet: ChipsFacet
  value: number | string | boolean
}

export function removeFacetValue(
  filters: StagedFilters,
  facet: ChipsFacet,
  value: number | string | boolean,
): StagedFilters {
  switch (facet) {
    case 'industries':
      return { ...filters, industries: filters.industries.filter((item) => item !== value) }
    case 'wilayas':
      return { ...filters, wilayas: filters.wilayas.filter((item) => item !== value) }
    case 'seniorities':
      return { ...filters, seniorities: filters.seniorities.filter((item) => item !== value) }
    case 'sizes':
      return { ...filters, sizes: filters.sizes.filter((item) => item !== value) }
    case 'keyword':
      return { ...filters, keyword: '' }
    case 'includeUnknownSize':
      return { ...filters, includeUnknownSize: false }
  }
}

export function sortParamFor(sort: SortState | null): string {
  return sort !== null && sort.dir !== null ? `${sort.field}:${sort.dir}` : 'name:asc'
}

export function parseSortParam(value: string | null): SortState | null {
  if (value === null || value === 'name:asc') return null
  const [field, dir] = value.split(':')
  if (!SORT_FIELDS.includes(field as SortField)) return null
  if (dir !== 'asc' && dir !== 'desc') return null
  return { field: field as SortField, dir }
}

function intList(raw: string | null): number[] {
  if (raw === null) return []
  return raw
    .split(',')
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1)
}

function stringList(raw: string | null): string[] {
  if (raw === null) return []
  return raw.split(',').filter((item) => item.length > 0)
}

export function filtersToParams(filters: StagedFilters, tab: SearchTab): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.industries.length > 0) params.set('ind', filters.industries.join(','))
  if (filters.wilayas.length > 0) params.set('wil', filters.wilayas.join(','))
  if (tab === 'people' && filters.seniorities.length > 0) {
    params.set('sen', filters.seniorities.join(','))
  }
  if (tab === 'companies') {
    if (filters.sizes.length > 0) params.set('siz', filters.sizes.join(','))
    if (filters.includeUnknownSize) params.set('unk', '1')
  }
  if (filters.keyword.trim().length > 0) params.set('kw', filters.keyword)
  return params
}

export function paramsToFilters(params: URLSearchParams, tab: SearchTab): StagedFilters {
  const filters: StagedFilters = { ...EMPTY_FILTERS }
  filters.industries = intList(params.get('ind'))
  filters.wilayas = intList(params.get('wil'))
  if (tab === 'people') filters.seniorities = stringList(params.get('sen'))
  if (tab === 'companies') {
    filters.sizes = stringList(params.get('siz'))
    filters.includeUnknownSize = params.get('unk') === '1'
  }
  filters.keyword = params.get('kw') ?? ''
  return filters
}

export function pageFromParams(params: URLSearchParams): number {
  const raw = params.get('page')
  if (raw === null) return 1
  const page = Number(raw)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

export function buildSearchUrl(
  pathname: string,
  filters: StagedFilters,
  sort: SortState | null,
  page: number,
  tab: SearchTab,
): string {
  const params = filtersToParams(filters, tab)
  const sortParam = sortParamFor(sort)
  if (sortParam !== 'name:asc') params.set('sort', sortParam)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  // An empty search is still a committed search ("search everything") — the
  // runs=1 marker distinguishes it from the never-ran clean URL.
  if (query.length === 0) return `${pathname}?runs=1`
  return `${pathname}?${query}`
}

export function buildSubmitted(params: URLSearchParams, tab: SearchTab): SearchSubmitted | null {
  const filters = paramsToFilters(params, tab)
  const committed =
    countActiveFilters(filters) > 0 ||
    params.get('sort') !== null ||
    params.get('page') !== null ||
    params.get('runs') === '1'
  if (!committed) return null
  return {
    filters,
    filtersJson: JSON.stringify(buildFiltersPayload(filters, tab)),
    page: pageFromParams(params),
    sort: sortParamFor(parseSortParam(params.get('sort'))),
  }
}