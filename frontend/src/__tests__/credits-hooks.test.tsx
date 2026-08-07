import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { creditsService } from '@/lib/api/credits-service'
import { creditsKeys } from '@/lib/queryKeys/credits'
import { useCreditsLedger } from '@/hooks/useCreditsLedger'
import { useCreditsBanner } from '@/hooks/useCreditsBanner'
import { useCreditsBannerMutations } from '@/hooks/useCreditsBannerMutations'
import type { LedgerResult } from '@/lib/api/credits-service'

vi.mock('@/lib/api/credits-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/credits-service')>()
  return {
    ...actual,
    creditsService: {
      ledger: vi.fn(),
      getBanner: vi.fn(),
      dismissBanner: vi.fn(),
    },
  }
})

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: null,
}

const PAGE: LedgerResult = {
  results: [],
  total: 0,
  page: 1,
  truncated: false,
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

describe('useCreditsLedger', () => {
  it('fetches the page when the user is authenticated', async () => {
    vi.mocked(creditsService.ledger).mockResolvedValue({ ...PAGE, total: 1 })
    const client = freshClient()
    const { result } = renderHook(() => useCreditsLedger({ user: USER, page: 1 }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(creditsService.ledger).toHaveBeenCalledWith(1)
    expect(result.current.rows).toEqual([])
    expect(result.current.total).toBe(1)
  })

  it('does not fetch for guests and reports idle, not loading', () => {
    const client = freshClient()
    const { result } = renderHook(() => useCreditsLedger({ user: null, page: 1 }), {
      wrapper: wrapperFor(client),
    })

    expect(creditsService.ledger).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
  })

  it('surfaces the error phase with a refetch', async () => {
    vi.mocked(creditsService.ledger).mockRejectedValueOnce(new Error('boom'))
    const client = freshClient()
    const { result } = renderHook(() => useCreditsLedger({ user: USER, page: 1 }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    vi.mocked(creditsService.ledger).mockResolvedValue(PAGE)
    result.current.refetch()
    await waitFor(() => expect(result.current.phase).toBe('success'))
  })

  it('refetches when the page changes (page is part of the query key)', async () => {
    vi.mocked(creditsService.ledger).mockResolvedValue(PAGE)
    const client = freshClient()
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => useCreditsLedger({ user: USER, page }),
      {
        wrapper: wrapperFor(client),
        initialProps: { page: 1 },
      },
    )
    await waitFor(() => expect(result.current.phase).toBe('success'))
    rerender({ page: 2 })
    await waitFor(() => expect(creditsService.ledger).toHaveBeenCalledWith(2))
  })

  it('scopes the ledger query key to the user email', async () => {
    vi.mocked(creditsService.ledger).mockResolvedValue(PAGE)
    const client = freshClient()
    const { result } = renderHook(() => useCreditsLedger({ user: USER, page: 1 }), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(result.current.phase).toBe('success'))
    const cache = client.getQueryCache().getAll()
    expect(cache.some((entry) => entry.queryKey[2] === 'a@b.dz')).toBe(true)
  })
})

describe('useCreditsBanner', () => {
  it('exposes the dismissed flag for an authenticated user', async () => {
    vi.mocked(creditsService.getBanner).mockResolvedValue({ dismissed: true })
    const client = freshClient()
    const { result } = renderHook(() => useCreditsBanner({ user: USER }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(creditsService.getBanner).toHaveBeenCalledTimes(1)
    expect(result.current.dismissed).toBe(true)
  })

  it('reports idle for guests without fetching', () => {
    const client = freshClient()
    const { result } = renderHook(() => useCreditsBanner({ user: null }), {
      wrapper: wrapperFor(client),
    })

    expect(creditsService.getBanner).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
  })
})

describe('useCreditsBannerMutations', () => {
  it('invalidates the credits factory prefix after a dismiss', async () => {
    vi.mocked(creditsService.dismissBanner).mockResolvedValue({ dismissed: true })
    const client = freshClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreditsBannerMutations(), {
      wrapper: wrapperFor(client),
    })

    await result.current.dismiss.mutateAsync()

    expect(creditsService.dismissBanner).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: creditsKeys.all })
  })
})
