import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSearchResults, type SearchSubmitted } from '@/hooks/useSearchResults'
import { buildFiltersPayload, type SearchResult } from '@/lib/api/search-service'

const hoisted = vi.hoisted(() => ({
  searchPeople: vi.fn(),
  searchCompanies: vi.fn(),
}))

vi.mock('@/lib/api/search-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/search-service')>()
  return {
    ...actual,
    searchService: {
      searchPeople: hoisted.searchPeople,
      searchCompanies: hoisted.searchCompanies,
    },
  }
})

const RESULT: SearchResult<{ id: string; name: string }> = {
  results: [{ id: '1', name: 'A' }],
  total: 1,
  page: 1,
  truncated: false,
  refine_prompt: null,
}

const SUBMITTED: SearchSubmitted = {
  filters: {
    industries: [],
    wilayas: [],
    seniorities: [],
    sizes: [],
    includeUnknownSize: false,
    keyword: '',
  },
  filtersJson: JSON.stringify(buildFiltersPayload({
    industries: [],
    wilayas: [],
    seniorities: [],
    sizes: [],
    includeUnknownSize: false,
    keyword: '',
  }, 'people')),
  page: 1,
  sort: 'name:asc',
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  hoisted.searchPeople.mockReset()
  hoisted.searchCompanies.mockReset()
})

describe('useSearchResults', () => {
  it('stays idle and fires nothing before a search is submitted', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(
      () => useSearchResults({ tab: 'people', submitted: null, onSuccess }),
      { wrapper },
    )

    expect(result.current.phase).toBe('idle')
    expect(result.current.rateLimitMessage).toBeUndefined()
    expect(hoisted.searchPeople).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('maps loading -> idle and reports success with the submitted filters', async () => {
    let resolve!: (value: typeof RESULT) => void
    hoisted.searchPeople.mockImplementation(
      () => new Promise<typeof RESULT>((r) => { resolve = r }),
    )
    const onSuccess = vi.fn()
    const { result, rerender } = renderHook(
      ({ submitted }) => useSearchResults({ tab: 'people', submitted, onSuccess }),
      { initialProps: { submitted: null as SearchSubmitted | null }, wrapper },
    )

    rerender({ submitted: SUBMITTED })
    expect(result.current.phase).toBe('loading')

    act(() => resolve(RESULT))
    await waitFor(() => expect(result.current.phase).toBe('idle'))
    expect(result.current.query.data?.total).toBe(1)
    expect(onSuccess).toHaveBeenCalledWith(SUBMITTED.filters)
    expect(hoisted.searchPeople).toHaveBeenCalledWith(
      SUBMITTED.filtersJson,
      1,
      'name:asc',
      expect.any(AbortSignal),
    )
  })

  it('enters the rate-limited phase with the server detail on 429', async () => {
    hoisted.searchPeople.mockRejectedValue({
      response: { status: 429, data: { detail: 'server.limit.message' } },
    })
    const onSuccess = vi.fn()
    const { result, rerender } = renderHook(
      ({ submitted }) => useSearchResults({ tab: 'people', submitted, onSuccess }),
      { initialProps: { submitted: null as SearchSubmitted | null }, wrapper },
    )

    rerender({ submitted: SUBMITTED })
    await waitFor(() => expect(result.current.phase).toBe('rate_limited'))
    expect(result.current.rateLimitMessage).toBe('server.limit.message')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('enters the error phase for non-429 failures and resets the message', async () => {
    hoisted.searchPeople.mockRejectedValue({ response: { status: 500 } })
    const { result, rerender } = renderHook(
      ({ submitted }) => useSearchResults({ tab: 'people', submitted, onSuccess: vi.fn() }),
      { initialProps: { submitted: null as SearchSubmitted | null }, wrapper },
    )

    rerender({ submitted: SUBMITTED })
    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.rateLimitMessage).toBeUndefined()
  })
})
