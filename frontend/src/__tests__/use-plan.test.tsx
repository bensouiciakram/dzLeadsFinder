import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { usePlan } from '@/hooks/usePlan'
import { billingKeys } from '@/lib/queryKeys/billing'

const hoisted = vi.hoisted(() => ({
  plan: vi.fn(),
}))

vi.mock('@/lib/api/billing-service', () => ({
  billingService: {
    plan: hoisted.plan,
  },
}))

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: '2026-08-01T12:00:00+01:00',
}

const PLAN = {
  tier: 'free',
  status: null,
  renews_on: null,
  balances: { subscription_balance: 0, pack_balance: 0, display_balance: 15 },
}

// Mirrors the global Providers.tsx defaults (retry:false,
// refetchOnWindowFocus:false) so the hook's deliberate override is what
// re-fetches on window focus.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  hoisted.plan.mockReset()
})

describe('usePlan', () => {
  it('stays idle for guests', () => {
    const { result } = renderHook(() => usePlan({ user: null }), { wrapper })

    expect(result.current.phase).toBe('idle')
    expect(result.current.plan).toBeNull()
    expect(hoisted.plan).not.toHaveBeenCalled()
  })

  it('fetches the plan for an authenticated user', async () => {
    hoisted.plan.mockResolvedValue(PLAN)

    const { result } = renderHook(() => usePlan({ user: USER }), { wrapper })

    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(result.current.plan).toEqual(PLAN)
    expect(hoisted.plan).toHaveBeenCalledTimes(1)
  })

  it('uses the exact billingKeys.plan derivation (no FE cache split-brain)', async () => {
    hoisted.plan.mockResolvedValue(PLAN)

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result } = renderHook(() => usePlan({ user: USER }), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    await waitFor(() => expect(result.current.phase).toBe('success'))
    // The same tuple the 5.5 useBilling derives (user?.email ?? 'guest') —
    // a mismatch would split the cache between the header and /billing.
    expect(
      client.getQueryState(billingKeys.plan('a@b.dz')),
    ).toBeDefined()
  })

  it('shares ONE cache entry with useBilling consumers', async () => {
    hoisted.plan.mockResolvedValue(PLAN)

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapperWithClient = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const first = renderHook(() => usePlan({ user: USER }), {
      wrapper: wrapperWithClient,
    })
    await waitFor(() => expect(first.result.current.phase).toBe('success'))

    // A second consumer mounts (the /billing page or another island). With
    // the global staleTime:0 contract the stale entry refetches — the pin
    // is the cache: ONE entry under the shared tuple, never a second key
    // (a userKey derivation mismatch would create two entries and the
    // banner/chip/BillingPage would diverge).
    const second = renderHook(() => usePlan({ user: USER }), {
      wrapper: wrapperWithClient,
    })
    await waitFor(() => expect(second.result.current.plan).not.toBeNull())
    expect(client.getQueryCache().getAll()).toHaveLength(1)
    expect(client.getQueryCache().getAll()[0].queryKey).toEqual(
      billingKeys.plan('a@b.dz'),
    )
  })

  it('maps query errors to the error phase', async () => {
    hoisted.plan.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => usePlan({ user: USER }), { wrapper })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.plan).toBeNull()
  })

  it('refetches on window focus (the banner-clear override)', async () => {
    hoisted.plan.mockResolvedValue(PLAN)

    const { result } = renderHook(() => usePlan({ user: USER }), { wrapper })
    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(hoisted.plan).toHaveBeenCalledTimes(1)

    // A paid user returns to the tab — the banner must clear promptly
    // (the AC "persists until payment succeeds"). The global default is
    // refetchOnWindowFocus:false (a quota contract for search only — the
    // plan GET is non-quota). focusManager.setFocused(true) is the
    // jsdom-safe focus simulation.
    focusManager.setFocused(true)
    await waitFor(() => expect(hoisted.plan).toHaveBeenCalledTimes(2))
    focusManager.setFocused(false)
  })
})
