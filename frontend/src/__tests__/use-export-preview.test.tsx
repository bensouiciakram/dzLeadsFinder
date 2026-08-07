import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { searchService, type PeopleResultRow, type SearchResult } from '@/lib/api/search-service'
import { searchKeys } from '@/lib/queryKeys/search'
import { useExportPreview } from '@/hooks/useExportPreview'

vi.mock('@/lib/api/search-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/search-service')>()
  return {
    ...actual,
    searchService: { searchPeople: vi.fn(), searchCompanies: vi.fn() },
  }
})

const FILTERS_JSON = '{}'
const SORT = 'name:asc'
const NONCE = 3

function pageData(page: number, start: number, count: number): SearchResult<PeopleResultRow> {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      id: `p-${start + i}`,
      name: `Name ${start + i}`,
      role: null,
      company_name: null,
      company_id: null,
      wilaya_code: null,
      wilaya_name: null,
      revealed: i % 2 === 0,
    })),
    total: 250,
    page,
    truncated: false,
    refine_prompt: null,
  }
}

function deferredResult<T>(value: T) {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve: () => resolve(value) }
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    tab: 'people' as const,
    filtersJson: FILTERS_JSON,
    sort: SORT,
    nonce: NONCE,
    total: 250,
    tier: 'starter' as const,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useExportPreview', () => {
  it('composes every page from the query cache with zero service calls', async () => {
    const client = freshClient()
    client.setQueryData(searchKeys.results('people', FILTERS_JSON, 1, SORT, NONCE), pageData(1, 0, 100))
    client.setQueryData(searchKeys.results('people', FILTERS_JSON, 2, SORT, NONCE), pageData(2, 100, 100))
    client.setQueryData(searchKeys.results('people', FILTERS_JSON, 3, SORT, NONCE), pageData(3, 200, 50))
    const { result } = renderHook(() => useExportPreview(baseProps()), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(result.current.preview?.ids).toHaveLength(250)
    expect(result.current.preview?.ids[0]).toBe('p-0')
    expect(result.current.preview?.ids[249]).toBe('p-249')
    expect(result.current.preview?.revealedCount).toBe(125)
    expect(result.current.preview?.unrevealedCount).toBe(125)
    expect(result.current.preview?.totalRows).toBe(250)
    expect(searchService.searchPeople).not.toHaveBeenCalled()
    expect(result.current.isCollecting).toBe(false)
  })

  it('fetches only the missing pages via the service, merged in page order', async () => {
    const client = freshClient()
    client.setQueryData(searchKeys.results('people', FILTERS_JSON, 1, SORT, NONCE), pageData(1, 0, 100))
    vi.mocked(searchService.searchPeople)
      .mockResolvedValueOnce(pageData(2, 100, 100))
      .mockResolvedValueOnce(pageData(3, 200, 50))
    const { result } = renderHook(() => useExportPreview(baseProps()), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(searchService.searchPeople).toHaveBeenCalledTimes(2)
    expect(vi.mocked(searchService.searchPeople).mock.calls[0][0]).toBe(FILTERS_JSON)
    expect(vi.mocked(searchService.searchPeople).mock.calls[0][1]).toBe(2)
    expect(vi.mocked(searchService.searchPeople).mock.calls[0][2]).toBe(SORT)
    expect(vi.mocked(searchService.searchPeople).mock.calls[1][1]).toBe(3)
    expect(result.current.preview?.ids).toHaveLength(250)
    expect(result.current.preview?.ids[0]).toBe('p-0')
    expect(result.current.preview?.ids[100]).toBe('p-100')
    expect(result.current.preview?.ids[249]).toBe('p-249')
  })

  it('caps the free tier at the first 5 rows of page 1 with zero fetches when cached', async () => {
    const client = freshClient()
    client.setQueryData(searchKeys.results('people', FILTERS_JSON, 1, SORT, NONCE), pageData(1, 0, 100))
    const { result } = renderHook(
      () => useExportPreview(baseProps({ tier: 'free' })),
      { wrapper: wrapperFor(client) },
    )

    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(result.current.preview?.ids).toEqual(['p-0', 'p-1', 'p-2', 'p-3', 'p-4'])
    expect(result.current.preview?.totalRows).toBe(5)
    expect(result.current.preview?.revealedCount).toBe(3)
    expect(result.current.preview?.unrevealedCount).toBe(2)
    expect(searchService.searchPeople).not.toHaveBeenCalled()
  })

  it('counts revealed rows with the search revealed flag (the ≤30d predicate)', async () => {
    const client = freshClient()
    client.setQueryData(searchKeys.results('people', FILTERS_JSON, 1, SORT, NONCE), {
      ...pageData(1, 0, 4),
      results: [
        { ...pageData(1, 0, 1).results[0], id: 'a', revealed: true },
        { ...pageData(1, 0, 1).results[0], id: 'b', revealed: true },
        { ...pageData(1, 0, 1).results[0], id: 'c', revealed: false },
        { ...pageData(1, 0, 1).results[0], id: 'd', revealed: false },
      ],
    })
    const { result } = renderHook(() => useExportPreview(baseProps({ total: 4 })), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(result.current.preview?.revealedCount).toBe(2)
    expect(result.current.preview?.unrevealedCount).toBe(2)
    expect(result.current.preview?.ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('passes an abort signal that aborts on unmount', async () => {
    const client = freshClient()
    let capturedSignal: AbortSignal | undefined
    vi.mocked(searchService.searchPeople).mockImplementation(
      (_f, _p, _s, signal) =>
        new Promise(() => {
          capturedSignal = signal
        }),
    )
    const { result, unmount } = renderHook(() => useExportPreview(baseProps()), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(searchService.searchPeople).toHaveBeenCalled())
    expect(capturedSignal).toBeDefined()
    expect(capturedSignal?.aborted).toBe(false)
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
    expect(result.current.isCollecting).toBe(true)
  })

  it('surfaces the collector error and keeps the preview null', async () => {
    const client = freshClient()
    vi.mocked(searchService.searchPeople).mockRejectedValue({
      response: { status: 429, data: { detail: 'limit' } },
    })
    const { result } = renderHook(() => useExportPreview(baseProps()), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.preview).toBeNull()
    expect(result.current.isCollecting).toBe(false)
  })

  it('retry re-runs the collector after a failure', async () => {
    const client = freshClient()
    vi.mocked(searchService.searchPeople)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(pageData(1, 0, 100))
    const { result } = renderHook(() => useExportPreview(baseProps({ total: 100 })), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    result.current.retry()
    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(result.current.preview?.ids).toHaveLength(100)
    expect(result.current.error).toBeNull()
  })

  it('does not collect while the modal is closed', async () => {
    const client = freshClient()
    const { result } = renderHook(() => useExportPreview(baseProps({ open: false })), {
      wrapper: wrapperFor(client),
    })

    expect(result.current.preview).toBeNull()
    expect(result.current.isCollecting).toBe(false)
    expect(searchService.searchPeople).not.toHaveBeenCalled()
  })

  it('clears the stale preview while the new collection is in flight (never confirm the old set)', async () => {
    const client = freshClient()
    const deferred = deferredResult(pageData(2, 100, 100))
    client.setQueryData(searchKeys.results('people', FILTERS_JSON, 1, SORT, NONCE), pageData(1, 0, 100))
    let callCount = 0
    vi.mocked(searchService.searchPeople).mockImplementation(() => {
      callCount += 1
      if (callCount <= 2) return Promise.resolve(pageData(2, 100, 100))
      return deferred.promise
    })
    const { result, rerender } = renderHook((props) => useExportPreview(props), {
      initialProps: baseProps(),
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(result.current.preview?.ids[0]).toBe('p-0')

    rerender(baseProps({ filtersJson: '{"keyword":"x"}' }))
    await waitFor(() => expect(result.current.isCollecting).toBe(true))
    expect(result.current.preview).toBeNull()

    deferred.resolve()
    await waitFor(() => expect(result.current.preview).not.toBeNull())
    expect(result.current.preview?.ids[0]).toBe('p-100')
  })
})
