import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { savedSearchService } from '@/lib/api/saved-search-service'
import { savedSearchesKeys } from '@/lib/queryKeys/savedSearches'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import { useSavedSearchMutations } from '@/hooks/useSavedSearchMutations'
import type { SavedSearchRow } from '@/lib/api/saved-search-service'

vi.mock('@/lib/api/saved-search-service', () => ({
  savedSearchService: {
    list: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
  },
}))

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: null,
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSavedSearches', () => {
  it('fetches the list when the user is authenticated', async () => {
    vi.mocked(savedSearchService.list).mockResolvedValue([])
    const client = freshClient()
    const { result } = renderHook(() => useSavedSearches({ user: USER }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(savedSearchService.list).toHaveBeenCalledTimes(1)
    expect(result.current.savedSearches).toEqual([])
  })

  it('does not fetch for guests and reports idle, not loading', () => {
    const client = freshClient()
    const { result } = renderHook(() => useSavedSearches({ user: null }), {
      wrapper: wrapperFor(client),
    })

    expect(savedSearchService.list).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
  })

  it('surfaces the error phase with a retry', async () => {
    vi.mocked(savedSearchService.list).mockRejectedValueOnce(new Error('boom'))
    const client = freshClient()
    const { result } = renderHook(() => useSavedSearches({ user: USER }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    vi.mocked(savedSearchService.list).mockResolvedValue([])
    result.current.refetch()
    await waitFor(() => expect(result.current.phase).toBe('success'))
  })

  it('surfaces background fetching without flipping to loading', async () => {
    let resolve: (rows: SavedSearchRow[]) => void = () => {}
    vi.mocked(savedSearchService.list).mockImplementation(
      () => new Promise<SavedSearchRow[]>((res) => (resolve = res)),
    )
    const client = freshClient()
    const { result } = renderHook(() => useSavedSearches({ user: USER }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('loading'))
    resolve([])
    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(result.current.isFetching).toBe(false)
  })
})

describe('useSavedSearchMutations', () => {
  it('invalidates the list factory key after a create', async () => {
    vi.mocked(savedSearchService.create).mockResolvedValue({
      id: '1',
      name: 'x',
      type: 'people',
      filters: {},
      sort: null,
      created_at: '',
      updated_at: '',
    })
    const client = freshClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSavedSearchMutations(), {
      wrapper: wrapperFor(client),
    })

    await result.current.create.mutateAsync({
      name: 'x',
      type: 'people',
      filters: {},
      sort: null,
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: savedSearchesKeys.list })
  })

  it('invalidates the list factory key after a rename', async () => {
    vi.mocked(savedSearchService.rename).mockResolvedValue({
      id: '1',
      name: 'y',
      type: 'people',
      filters: {},
      sort: null,
      created_at: '',
      updated_at: '',
    })
    const client = freshClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSavedSearchMutations(), {
      wrapper: wrapperFor(client),
    })

    await result.current.rename.mutateAsync({ id: '1', name: 'y' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: savedSearchesKeys.list })
  })

  it('invalidates the list factory key after a remove', async () => {
    vi.mocked(savedSearchService.remove).mockResolvedValue(undefined)
    const client = freshClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSavedSearchMutations(), {
      wrapper: wrapperFor(client),
    })

    await result.current.remove.mutateAsync('1')

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: savedSearchesKeys.list })
  })
})
