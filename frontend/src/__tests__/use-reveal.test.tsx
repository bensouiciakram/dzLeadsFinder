import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { revealService } from '@/lib/api/reveal-service'
import type { RevealResult } from '@/lib/api/reveal-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'
import { revealKeys } from '@/lib/queryKeys/reveal'
import { searchKeys } from '@/lib/queryKeys/search'
import { useReveal } from '@/hooks/useReveal'

const sessionMock = vi.hoisted(() => ({
  user: {
    email: 'a@b.dz',
    locale: 'en',
    tier: 'free',
    credits_balance: 15,
    email_verified_at: null,
  },
  refresh: vi.fn(),
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({
    user: sessionMock.user,
    refresh: sessionMock.refresh,
  }),
}))

const creditsMock = vi.hoisted(() => ({
  balance: 15,
  applyCreditDelta: vi.fn(),
  applyConfirmedBalance: vi.fn(),
}))

vi.mock('@/components/providers/CreditProvider', () => ({
  useCredits: () => creditsMock,
}))

vi.mock('@/lib/api/reveal-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/reveal-service')>()
  return {
    ...actual,
    revealService: { reveal: vi.fn() },
  }
})

const RESULT: RevealResult = {
  contact: {
    record_type: 'people',
    record_id: 'abc',
    name: 'Karim Benali',
    role: 'CEO',
    company_name: 'ACME Algérie',
    email: 'karim@acme.dz',
    phone: '0550 12 34 56',
    address: 'Alger Centre, Alger',
  },
  balances: {
    subscription_balance: 2,
    pack_balance: 0,
    display_balance: 2,
  },
}

const VARS = { type: 'people' as const, id: 'abc' }

function deferredResult<T>(value: T) {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionMock.user = {
    email: 'a@b.dz',
    locale: 'en',
    tier: 'free',
    credits_balance: 15,
    email_verified_at: null,
  }
  sessionMock.refresh.mockResolvedValue('authenticated')
})

describe('useReveal', () => {
  it('applies the optimistic -1 credit delta synchronously on mutate', () => {
    const client = freshClient()
    vi.mocked(revealService.reveal).mockResolvedValue(RESULT)
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    result.current.reveal.mutate(VARS)

    expect(creditsMock.applyCreditDelta).toHaveBeenCalledWith(-1)
  })

  it('applies the confirmed balance and writes the contact cache on success', async () => {
    const client = freshClient()
    vi.mocked(revealService.reveal).mockResolvedValue(RESULT)
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    await result.current.reveal.mutateAsync(VARS)

    expect(creditsMock.applyConfirmedBalance).toHaveBeenCalledWith(RESULT.balances)
    expect(client.getQueryData(revealKeys.contact('a@b.dz', 'people', 'abc'))).toEqual(RESULT)
  })

  it('flips the matching search result row to revealed on success', async () => {
    const client = freshClient()
    vi.mocked(revealService.reveal).mockResolvedValue(RESULT)
    client.setQueryData(searchKeys.results('people', '{}', 1, 'name:asc', 0), {
      results: [
        { id: 'abc', name: 'Karim', revealed: false },
        { id: 'xyz', name: 'Amine', revealed: false },
      ],
      total: 2,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    await result.current.reveal.mutateAsync(VARS)

    const data = client.getQueryData(searchKeys.results('people', '{}', 1, 'name:asc', 0)) as {
      results: Array<{ id: string; revealed: boolean }>
    }
    expect(data.results.find((row) => row.id === 'abc')?.revealed).toBe(true)
    expect(data.results.find((row) => row.id === 'xyz')?.revealed).toBe(false)
  })

  it('invalidates the checklist factory prefix on success (3.7 event contract)', async () => {
    const client = freshClient()
    vi.mocked(revealService.reveal).mockResolvedValue(RESULT)
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    await result.current.reveal.mutateAsync(VARS)

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: checklistKeys.all })
  })

  it('rolls the credit back with +1 and reconciles via the session probe on failure', async () => {
    const client = freshClient()
    vi.mocked(revealService.reveal).mockRejectedValue(new Error('boom'))
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    await expect(result.current.reveal.mutateAsync(VARS)).rejects.toThrow('boom')

    expect(creditsMock.applyCreditDelta).toHaveBeenNthCalledWith(1, -1)
    expect(creditsMock.applyCreditDelta).toHaveBeenNthCalledWith(2, 1)
    expect(creditsMock.applyConfirmedBalance).not.toHaveBeenCalled()
    expect(sessionMock.refresh).toHaveBeenCalled()
    expect(client.getQueryData(revealKeys.contact('a@b.dz', 'people', 'abc'))).toBeUndefined()
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: checklistKeys.all })
  })

  it('handles a 200 without balances defensively and still caches the contact', async () => {
    const client = freshClient()
    vi.mocked(revealService.reveal).mockResolvedValue({
      contact: RESULT.contact,
      balances: undefined as unknown as RevealResult['balances'],
    })
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    await result.current.reveal.mutateAsync(VARS)

    expect(creditsMock.applyConfirmedBalance).not.toHaveBeenCalled()
    expect(client.getQueryData(revealKeys.contact('a@b.dz', 'people', 'abc'))).toEqual({
      contact: RESULT.contact,
      balances: undefined,
    })
  })

  it('skips UI side effects when the session user changes mid-flight', async () => {
    const client = freshClient()
    const deferred = deferredResult(RESULT)
    vi.mocked(revealService.reveal).mockReturnValue(deferred.promise)
    const { result, rerender } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    const pending = result.current.reveal.mutateAsync(VARS)
    sessionMock.user = { ...sessionMock.user, email: 'other@x.dz' }
    rerender()
    deferred.resolve(RESULT)
    await pending

    expect(creditsMock.applyConfirmedBalance).not.toHaveBeenCalled()
    expect(client.getQueryData(revealKeys.contact('a@b.dz', 'people', 'abc'))).toBeUndefined()
  })

  it('marks the shared in-flight key during the mutation and clears it on settle', async () => {
    const client = freshClient()
    const deferred = deferredResult(RESULT)
    vi.mocked(revealService.reveal).mockReturnValue(deferred.promise)
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    const pending = result.current.reveal.mutateAsync(VARS)
    await waitFor(() =>
      expect(client.getQueryData(revealKeys.inFlight)).toEqual({
        type: 'people',
        id: 'abc',
        userKey: 'a@b.dz',
      }),
    )
    deferred.resolve(RESULT)
    await pending
    await waitFor(() => expect(client.getQueryData(revealKeys.inFlight)).toBeNull())
  })

  it('scopes the contact cache key to the user email', async () => {
    const client = freshClient()
    vi.mocked(revealService.reveal).mockResolvedValue(RESULT)
    const { result } = renderHook(() => useReveal(), { wrapper: wrapperFor(client) })

    await result.current.reveal.mutateAsync(VARS)

    const keys = client.getQueryCache().getAll().map((entry) => entry.queryKey)
    expect(keys.some((key) => key[2] === 'a@b.dz' && key[3] === 'people')).toBe(true)
  })
})
