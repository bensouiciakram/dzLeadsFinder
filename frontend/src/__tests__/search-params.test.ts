import { describe, expect, it } from 'vitest'

import {
  buildSearchUrl,
  buildSubmitted,
  filtersToParams,
  pageFromParams,
  paramsToFilters,
  parseSortParam,
  removeFacetValue,
  sortParamFor,
} from '@/lib/search/search-params'
import { EMPTY_FILTERS, type StagedFilters } from '@/lib/api/search-service'

const FILTERED: StagedFilters = {
  industries: [1, 4],
  wilayas: [31, 16],
  seniorities: ['director', 'manager'],
  sizes: ['1-10', '500+'],
  includeUnknownSize: true,
  keyword: 'oran',
}

describe('sortParamFor / parseSortParam', () => {
  it('treats the default sort as null', () => {
    expect(sortParamFor(null)).toBe('name:asc')
    expect(parseSortParam(null)).toBeNull()
    expect(parseSortParam('name:asc')).toBeNull()
  })

  it('round-trips an explicit sort', () => {
    expect(sortParamFor({ field: 'role', dir: 'desc' })).toBe('role:desc')
    expect(parseSortParam('role:desc')).toEqual({ field: 'role', dir: 'desc' })
  })

  it('rejects unknown fields, missing directions and garbage', () => {
    expect(parseSortParam('bogus:asc')).toBeNull()
    expect(parseSortParam('name:diagonal')).toBeNull()
    expect(parseSortParam('name')).toBeNull()
    expect(parseSortParam('')).toBeNull()
  })
})

describe('filtersToParams / paramsToFilters', () => {
  it('round-trips people filters and drops company-only facets', () => {
    const params = filtersToParams(FILTERED, 'people')
    expect(params.get('sen')).toBe('director,manager')
    expect(params.get('siz')).toBeNull()
    expect(params.get('unk')).toBeNull()
    expect(paramsToFilters(params, 'people')).toEqual({
      industries: [1, 4],
      wilayas: [31, 16],
      seniorities: ['director', 'manager'],
      sizes: [],
      includeUnknownSize: false,
      keyword: 'oran',
    })
  })

  it('round-trips companies filters and drops people-only facets', () => {
    const params = filtersToParams(FILTERED, 'companies')
    expect(params.get('siz')).toBe('1-10,500+')
    expect(params.get('unk')).toBe('1')
    expect(params.get('sen')).toBeNull()
    expect(paramsToFilters(params, 'companies')).toEqual({
      industries: [1, 4],
      wilayas: [31, 16],
      seniorities: [],
      sizes: ['1-10', '500+'],
      includeUnknownSize: true,
      keyword: 'oran',
    })
  })

  it('ignores cross-tab params from the URL', () => {
    const params = new URLSearchParams('sen=director&siz=1-10&unk=1&ind=1,4&wil=31&kw=oran')
    expect(paramsToFilters(params, 'people')).toEqual({
      industries: [1, 4],
      wilayas: [31],
      seniorities: ['director'],
      sizes: [],
      includeUnknownSize: false,
      keyword: 'oran',
    })
    expect(paramsToFilters(params, 'companies')).toEqual({
      industries: [1, 4],
      wilayas: [31],
      seniorities: [],
      sizes: ['1-10'],
      includeUnknownSize: true,
      keyword: 'oran',
    })
  })

  it('drops non-integer and negative ids and empty list members', () => {
    const params = new URLSearchParams('ind=1,x,2.5,-3&wil=31,0&sen=director,,manager')
    const filters = paramsToFilters(params, 'people')
    expect(filters.industries).toEqual([1])
    expect(filters.wilayas).toEqual([31])
    expect(filters.seniorities).toEqual(['director', 'manager'])
  })

  it('omits empty facets from the URL', () => {
    expect(filtersToParams({ ...EMPTY_FILTERS }, 'people').toString()).toBe('')
  })

  it('encodes and decodes a keyword with spaces and special characters', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, keyword: 'ben ali & co' }, 'people')
    expect(params.get('kw')).toBe('ben ali & co')
    expect(paramsToFilters(params, 'people').keyword).toBe('ben ali & co')
  })
})

describe('pageFromParams', () => {
  it('defaults to page 1', () => {
    expect(pageFromParams(new URLSearchParams())).toBe(1)
    expect(pageFromParams(new URLSearchParams('page=abc'))).toBe(1)
    expect(pageFromParams(new URLSearchParams('page=-3'))).toBe(1)
  })

  it('reads a valid page', () => {
    expect(pageFromParams(new URLSearchParams('page=4'))).toBe(4)
  })
})

describe('buildSearchUrl', () => {
  it('marks the empty committed search with runs=1', () => {
    expect(buildSearchUrl('/search', EMPTY_FILTERS, null, 1, 'people')).toBe('/search?runs=1')
  })

  it('serializes filters, non-default sort and page', () => {
    const url = buildSearchUrl(
      '/search',
      { ...EMPTY_FILTERS, industries: [1], keyword: 'oran' },
      { field: 'role', dir: 'asc' },
      2,
      'people',
    )
    expect(url).toBe('/search?ind=1&kw=oran&sort=role%3Aasc&page=2')
  })

  it('omits the default sort and page 1', () => {
    const url = buildSearchUrl('/search', { ...EMPTY_FILTERS, wilayas: [31] }, null, 1, 'people')
    expect(url).toBe('/search?wil=31')
  })
})

describe('buildSubmitted', () => {
  it('returns null for an empty URL', () => {
    expect(buildSubmitted(new URLSearchParams(), 'people')).toBeNull()
  })

  it('ignores a lone cross-tab facet', () => {
    expect(buildSubmitted(new URLSearchParams('sen=director'), 'companies')).toBeNull()
  })

  it('builds the submitted search from filters', () => {
    const submitted = buildSubmitted(new URLSearchParams('ind=1,4&kw=oran'), 'people')
    expect(submitted).not.toBeNull()
    expect(submitted!.filters.industries).toEqual([1, 4])
    expect(submitted!.page).toBe(1)
    expect(submitted!.sort).toBe('name:asc')
    expect(JSON.parse(submitted!.filtersJson)).toEqual({
      industry: [1, 4],
      wilaya: [],
      seniority: [],
      keyword: 'oran',
    })
  })

  it('supports sort-only and page-only searches', () => {
    expect(buildSubmitted(new URLSearchParams('sort=role%3Adesc'), 'people')!.sort).toBe('role:desc')
    expect(buildSubmitted(new URLSearchParams('page=3'), 'people')!.page).toBe(3)
  })

  it('distinguishes a committed empty search (runs=1) from the never-ran URL', () => {
    const submitted = buildSubmitted(new URLSearchParams('runs=1'), 'people')
    expect(submitted).not.toBeNull()
    expect(submitted!.filters).toEqual(EMPTY_FILTERS)
    expect(submitted!.page).toBe(1)
    expect(submitted!.sort).toBe('name:asc')
  })
})

describe('removeFacetValue', () => {
  it('removes a value from each array facet', () => {
    const base: StagedFilters = {
      ...EMPTY_FILTERS,
      industries: [1, 4],
      wilayas: [31],
      seniorities: ['director'],
      sizes: ['1-10'],
    }
    expect(removeFacetValue(base, 'industries', 1).industries).toEqual([4])
    expect(removeFacetValue(base, 'wilayas', 31).wilayas).toEqual([])
    expect(removeFacetValue(base, 'seniorities', 'director').seniorities).toEqual([])
    expect(removeFacetValue(base, 'sizes', '1-10').sizes).toEqual([])
  })

  it('clears the keyword and the unknown-size toggle', () => {
    const base: StagedFilters = { ...EMPTY_FILTERS, keyword: 'oran', includeUnknownSize: true }
    expect(removeFacetValue(base, 'keyword', 'oran').keyword).toBe('')
    expect(removeFacetValue(base, 'includeUnknownSize', true).includeUnknownSize).toBe(false)
  })
})