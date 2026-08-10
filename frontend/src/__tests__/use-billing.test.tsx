import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { useBilling } from '@/hooks/useBilling'
import { billingKeys } from '@/lib/queryKeys/billing'

const hoisted = vi.hoisted(() => ({
  plan: vi.fn(),
  packs: vi.fn(),
  history: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock('@/lib/api/billing-service', () => ({
  billingService: {
    plan: hoisted.plan,
    packs: hoisted.packs,
    history: hoisted.history,
    cancel: hoisted.cancel,
  },
}))

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'starter',
  credits_balance: 100,
  email_verified_at: '2026-08-01T12:00:00+01:00',
}

const PLAN = {
  tier: 'starter',
  status: 'active',
  renews_on: '2026-09-30',
  balances: { subscription_balance: 100, pack_balance: 0, display_balance: 100 },
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  hoisted.plan.mockReset()
  hoisted.packs.mockReset()
  hoisted.history.mockReset()
  hoisted.cancel.mockReset()
})

describe('useBilling', () => {
  it('stays idle for guests', () => {
    const { result } = renderHook(() => useBilling({ user: null }), { wrapper })

    expect(result.current.planPhase).toBe('idle')
    expect(result.current.plan).toBeNull()
    expect(hoisted.plan).not.toHaveBeenCalled()
  })

  it('fetches plan, packs and history for an authenticated user', async () => {
    hoisted.plan.mockResolvedValue(PLAN)
    hoisted.packs.mockResolvedValue({ packs: [], never_expires: true })
    hoisted.history.mockResolvedValue({ results: [] })

    const { result } = renderHook(() => useBilling({ user: USER }), { wrapper })

    await waitFor(() => expect(result.current.planPhase).toBe('success'))
    expect(result.current.plan).toEqual(PLAN)
    expect(result.current.packsPhase).toBe('success')
    expect(result.current.historyPhase).toBe('success')
    expect(hoisted.plan).toHaveBeenCalledTimes(1)
    expect(hoisted.packs).toHaveBeenCalledTimes(1)
    expect(hoisted.history).toHaveBeenCalledTimes(1)
  })

  it('maps query errors to the error phase', async () => {
    hoisted.plan.mockRejectedValue(new Error('boom'))
    hoisted.packs.mockResolvedValue({ packs: [], never_expires: true })
    hoisted.history.mockResolvedValue({ results: [] })

    const { result } = renderHook(() => useBilling({ user: USER }), { wrapper })

    await waitFor(() => expect(result.current.planPhase).toBe('error'))
    expect(result.current.plan).toBeNull()
  })

  it('invalidates the plan query when the cancel mutation succeeds', async () => {
    hoisted.plan.mockResolvedValue(PLAN)
    hoisted.packs.mockResolvedValue({ packs: [], never_expires: true })
    hoisted.history.mockResolvedValue({ results: [] })
    hoisted.cancel.mockResolvedValue({
      status: 'cancelled',
      cancelled_at: '2026-08-10T12:00:00+01:00',
    })

    const { result } = renderHook(() => useBilling({ user: USER }), { wrapper })
    await waitFor(() => expect(result.current.planPhase).toBe('success'))

    const planSpy = vi.fn()
    ;(hoisted.plan as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      planSpy()
      return { ...PLAN, status: 'cancelled' }
    })

    result.current.cancel.mutate()
    await waitFor(() => expect(result.current.cancel.isSuccess).toBe(true))
    // The invalidation refetches the plan — the card flips to cancelled.
    await waitFor(() => expect(planSpy).toHaveBeenCalled())
    await waitFor(() => expect(result.current.plan?.status).toBe('cancelled'))
  })

  it('surfaces the mutation error state without invalidating', async () => {
    hoisted.plan.mockResolvedValue(PLAN)
    hoisted.packs.mockResolvedValue({ packs: [], never_expires: true })
    hoisted.history.mockResolvedValue({ results: [] })
    hoisted.cancel.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useBilling({ user: USER }), { wrapper })
    await waitFor(() => expect(result.current.planPhase).toBe('success'))

    result.current.cancel.mutate()
    await waitFor(() => expect(result.current.cancel.isError).toBe(true))
    expect(result.current.plan?.status).toBe('active')
  })
})
