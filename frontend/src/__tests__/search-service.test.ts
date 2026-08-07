import axios from 'axios'
import type {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { describe, expect, it, vi } from 'vitest'

import {
  EMPTY_FILTERS,
  SearchService,
  buildFiltersPayload,
  countActiveFilters,
  filtersPayloadToStaged,
  type StagedFilters,
} from '@/lib/api/search-service'

describe('countActiveFilters', () => {
  it('counts zero for the empty draft', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
  })

  it('counts each selected industry', () => {
    const draft: StagedFilters = { ...EMPTY_FILTERS, industries: [1, 2] }
    expect(countActiveFilters(draft)).toBe(2)
  })

  it('counts wilayas and seniorities together', () => {
    const draft: StagedFilters = { ...EMPTY_FILTERS, wilayas: [31], seniorities: ['director'] }
    expect(countActiveFilters(draft)).toBe(2)
  })

  it('counts a non-empty keyword as one filter', () => {
    const draft: StagedFilters = { ...EMPTY_FILTERS, keyword: 'café' }
    expect(countActiveFilters(draft)).toBe(1)
  })

  it('counts the include-unknown-size toggle when on', () => {
    const draft: StagedFilters = { ...EMPTY_FILTERS, sizes: ['1-10'], includeUnknownSize: true }
    expect(countActiveFilters(draft)).toBe(2)
  })

  it('does not count an empty keyword or off toggle', () => {
    const draft: StagedFilters = { ...EMPTY_FILTERS, keyword: '   ', includeUnknownSize: false }
    expect(countActiveFilters(draft)).toBe(0)
  })
})

describe('buildFiltersPayload', () => {
  it('emits only the people key set', () => {
    const draft: StagedFilters = {
      industries: [4, 9],
      wilayas: [31],
      seniorities: ['owner_founder'],
      sizes: ['1-10'],
      includeUnknownSize: true,
      keyword: 'oran',
    }
    expect(buildFiltersPayload(draft, 'people')).toEqual({
      industry: [4, 9],
      wilaya: [31],
      seniority: ['owner_founder'],
      keyword: 'oran',
    })
  })

  it('never leaks company-only fields into a people payload', () => {
    const draft: StagedFilters = { ...EMPTY_FILTERS, sizes: ['500+'], includeUnknownSize: true }
    const payload = buildFiltersPayload(draft, 'people')
    expect(payload).not.toHaveProperty('size')
    expect(payload).not.toHaveProperty('include_unknown_size')
  })

  it('emits the companies key set with include_unknown_size always present', () => {
    const draft: StagedFilters = {
      industries: [21],
      wilayas: [16, 31],
      seniorities: ['manager'],
      sizes: ['11-50'],
      includeUnknownSize: false,
      keyword: '',
    }
    expect(buildFiltersPayload(draft, 'companies')).toEqual({
      industry: [21],
      wilaya: [16, 31],
      size: ['11-50'],
      keyword: '',
      include_unknown_size: false,
    })
  })

  it('serializes empty lists as empty arrays', () => {
    expect(buildFiltersPayload(EMPTY_FILTERS, 'people')).toEqual({
      industry: [],
      wilaya: [],
      seniority: [],
      keyword: '',
    })
  })
})

describe('filtersPayloadToStaged', () => {
  const full: StagedFilters = {
    industries: [4, 9],
    wilayas: [31, 16],
    seniorities: ['owner_founder', 'director'],
    sizes: ['1-10', '500+'],
    includeUnknownSize: true,
    keyword: 'oran',
  }

  it('round-trips people payloads exactly (JSONB contract)', () => {
    const staged = filtersPayloadToStaged(buildFiltersPayload(full, 'people'), 'people')
    expect(staged).toEqual({
      industries: [4, 9],
      wilayas: [31, 16],
      seniorities: ['owner_founder', 'director'],
      sizes: [],
      includeUnknownSize: false,
      keyword: 'oran',
    })
    expect(buildFiltersPayload(staged, 'people')).toEqual(buildFiltersPayload(full, 'people'))
  })

  it('round-trips companies payloads exactly (JSONB contract)', () => {
    const staged = filtersPayloadToStaged(buildFiltersPayload(full, 'companies'), 'companies')
    expect(staged).toEqual({
      industries: [4, 9],
      wilayas: [31, 16],
      seniorities: [],
      sizes: ['1-10', '500+'],
      includeUnknownSize: true,
      keyword: 'oran',
    })
    expect(buildFiltersPayload(staged, 'companies')).toEqual(
      buildFiltersPayload(full, 'companies'),
    )
  })

  it('degrades missing or foreign keys to empty defaults', () => {
    expect(filtersPayloadToStaged({}, 'people')).toEqual(EMPTY_FILTERS)
    expect(filtersPayloadToStaged({ industry: 'x', wilaya: [true] }, 'people')).toEqual(
      EMPTY_FILTERS,
    )
    expect(filtersPayloadToStaged({ seniority: ['director'] }, 'companies')).toEqual(
      EMPTY_FILTERS,
    )
  })
})

describe('SearchService', () => {
  function stubClient(service: SearchService, response: unknown) {
    const getMock = vi.fn().mockResolvedValue({ data: response })
    ;(service as unknown as { client: { get: typeof getMock } }).client.get = getMock
    return getMock
  }

  it('queries /search/people/ with JSON-encoded filters and default page/sort', async () => {
    const service = new SearchService()
    const getMock = stubClient(service, {
      results: [],
      total: 0,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })

    const result = await service.searchPeople('{"industry":[1]}')

    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith('/search/people/', {
      params: { filters: '{"industry":[1]}', page: 1, sort: 'name:asc' },
    })
    expect(result.total).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it('passes through explicit page and sort', async () => {
    const service = new SearchService()
    const getMock = stubClient(service, {
      results: [],
      total: 0,
      page: 2,
      truncated: false,
      refine_prompt: null,
    })

    await service.searchPeople('{}', 2, 'name:desc')

    expect(getMock).toHaveBeenCalledWith('/search/people/', {
      params: { filters: '{}', page: 2, sort: 'name:desc' },
    })
  })

  it('queries /search/companies/ with the same contract', async () => {
    const service = new SearchService()
    const getMock = stubClient(service, {
      results: [],
      total: 3,
      page: 1,
      truncated: true,
      refine_prompt: 'refine',
    })

    const result = await service.searchCompanies('{"size":["1-10"]}')

    expect(getMock).toHaveBeenCalledWith('/search/companies/', {
      params: { filters: '{"size":["1-10"]}', page: 1, sort: 'name:asc' },
    })
    expect(result.total).toBe(3)
    expect(result.truncated).toBe(true)
    expect(result.refine_prompt).toBe('refine')
  })

  it('carries a timeout on the shared axios instance (hung-request guard)', () => {
    const service = new SearchService()
    const defaults = (service as unknown as { client: { defaults: { timeout?: number } } })
      .client.defaults
    expect(defaults.timeout).toBeGreaterThan(0)
  })

  it('forwards an abort signal so in-flight queries can be cancelled', async () => {
    const service = new SearchService()
    const getMock = stubClient(service, {
      results: [],
      total: 0,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })
    const controller = new AbortController()

    await service.searchPeople('{}', 2, 'name:asc', controller.signal)

    expect(getMock).toHaveBeenCalledWith('/search/people/', {
      params: { filters: '{}', page: 2, sort: 'name:asc' },
      signal: controller.signal,
    })
  })

  it('never double-prefixes the API base URL (real axios merge guard)', async () => {
    const urls: string[] = []
    const adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      urls.push(axios.getUri({ baseURL: config.baseURL, url: config.url }))
      return {
        data: { results: [], total: 0, page: 1, truncated: false, refine_prompt: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    const service = new SearchService({ adapter } as AxiosRequestConfig)

    await service.searchPeople('{}')
    await service.searchCompanies('{}')

    expect(urls).toEqual(['/api/search/people/', '/api/search/companies/'])
    for (const url of urls) {
      expect(url.startsWith('/api/')).toBe(true)
      expect(url).not.toContain('/api/api/')
    }
  })

  it('types people rows with the 3.2 people key set', async () => {
    const service = new SearchService()
    const row = {
      id: '1',
      name: 'Amina',
      role: 'Gérante',
      company_name: 'SARL X',
      wilaya_code: 31,
      wilaya_name: 'Oran',
      revealed: false,
    }
    const getMock = stubClient(service, {
      results: [row],
      total: 1,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })

    const result = await service.searchPeople('{}')
    const first = result.results[0]
    expect(first.name).toBe('Amina')
    expect(first.wilaya_code).toBe(31)
    expect(first.revealed).toBe(false)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('types company rows with the 3.2 company key set plus the 4.1 revealed flag', async () => {
    const service = new SearchService()
    const getMock = stubClient(service, {
      results: [
        {
          id: '9',
          name: 'SARL X',
          industry: 'Construction',
          industry_id: 1,
          wilaya_code: 16,
          wilaya_name: 'Algiers',
          size_band: '11-50',
          people_count: 2,
          revealed: true,
        },
      ],
      total: 1,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })

    const result = await service.searchCompanies('{}')
    const first = result.results[0]
    expect(first.people_count).toBe(2)
    expect(first.size_band).toBe('11-50')
    expect(first.revealed).toBe(true)
    expect(getMock).toHaveBeenCalledTimes(1)
  })
})
