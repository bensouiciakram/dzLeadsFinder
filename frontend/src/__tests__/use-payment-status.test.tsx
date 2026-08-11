import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { usePaymentStatus } from '@/hooks/usePaymentStatus'

const hoisted = vi.hoisted(() => ({
  status: vi.fn(),
}))

vi.mock('@/lib/api/billing-service', () => ({
  billingService: {
    status: hoisted.status,
  },
  PAYMENT_POLL_DEADLINE_MS: 60_000,
  PAYMENT_POLL_INTERVAL_MS: 5_000,
  TERMINAL_PAYMENT_STATUSES: new Set(['succeeded', 'failed', 'refunded']),
}))

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'starter',
  credits_balance: 100,
  email_verified_at: '2026-08-01T12:00:00+01:00',
}

const PENDING = {
  id: null,
  status: 'pending',
  type: null,
  credits_granted: null,
  date: null,
}

const STARTED_AT = '2026-08-11T12:00:00+01:00'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  hoisted.status.mockReset()
})

describe('usePaymentStatus', () => {
  it('stays disabled (idle) without an entry or user', () => {
    const { result } = renderHook(
      () => usePaymentStatus({ user: null, checkout: null }),
      { wrapper },
    )
    expect(result.current.state).toBe('polling')
    expect(hoisted.status).not.toHaveBeenCalled()
  })

  it('polls /billing/status with the checkout id and the server started_at', async () => {
    hoisted.status.mockResolvedValue(PENDING)

    const { result } = renderHook(
      () =>
        usePaymentStatus({
          user: USER,
          checkout: { checkout_id: 'checkout_abc', started_at: STARTED_AT },
        }),
      { wrapper },
    )

    await waitFor(() => expect(hoisted.status).toHaveBeenCalled())
    const [txnId, since] = hoisted.status.mock.calls[0]
    expect(txnId).toBe('checkout_abc')
    expect(since).toBe(STARTED_AT)
    await waitFor(() => expect(result.current.state).toBe('polling'))
  })

  it('flips to success on a succeeded row and stops polling', async () => {
    hoisted.status.mockResolvedValue({
      id: 'txn-1',
      status: 'succeeded',
      type: 'pack_purchase',
      credits_granted: 75,
      date: '2026-08-11T12:00:30+01:00',
    })

    const { result } = renderHook(
      () =>
        usePaymentStatus({
          user: USER,
          checkout: { checkout_id: 'checkout_abc', started_at: STARTED_AT },
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.state).toBe('success'))
    expect(result.current.cardType).toBe('pack_purchase')
    expect(result.current.creditsGranted).toBe(75)
  })

  it('re-polls every 5s while pending and stops on the first terminal state', async () => {
    vi.useFakeTimers()
    try {
      const started = new Date(Date.now()).toISOString()
      hoisted.status
        .mockResolvedValueOnce(PENDING)
        .mockResolvedValueOnce(PENDING)
        .mockResolvedValue({
          id: 'txn-1',
          status: 'succeeded',
          type: 'pack_purchase',
          credits_granted: 75,
          date: '2026-08-11T12:00:30+01:00',
        })

      const { result } = renderHook(
        () =>
          usePaymentStatus({
            user: USER,
            checkout: { checkout_id: 'checkout_abc', started_at: started },
          }),
        { wrapper },
      )
      await vi.advanceTimersByTimeAsync(0)
      expect(hoisted.status).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(5_000)
      expect(hoisted.status).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(5_000)
      expect(hoisted.status).toHaveBeenCalledTimes(3)
      await vi.waitFor(() => expect(result.current.state).toBe('success'))

      // The terminal status stops the interval — no further polling.
      await vi.advanceTimersByTimeAsync(60_000)
      expect(hoisted.status).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops polling on a failed row and reports the failed state', async () => {
    hoisted.status.mockResolvedValue({
      id: 'txn-1',
      status: 'failed',
      type: 'pack_purchase',
      credits_granted: null,
      date: '2026-08-11T12:00:30+01:00',
    })

    const { result } = renderHook(
      () =>
        usePaymentStatus({
          user: USER,
          checkout: { checkout_id: 'checkout_abc', started_at: STARTED_AT },
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.state).toBe('failed'))
  })

  it('maps a refunded row into the failed family (John V1)', async () => {
    hoisted.status.mockResolvedValue({
      id: 'txn-1',
      status: 'refunded',
      type: 'pack_purchase',
      credits_granted: 75,
      date: '2026-08-11T12:00:30+01:00',
    })

    const { result } = renderHook(
      () =>
        usePaymentStatus({
          user: USER,
          checkout: { checkout_id: 'checkout_abc', started_at: STARTED_AT },
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.state).toBe('failed'))
  })

  it('times out once the 60s deadline passes while still pending', async () => {
    vi.useFakeTimers()
    try {
      hoisted.status.mockResolvedValue(PENDING)

      const started = new Date(Date.now() - 59_000).toISOString()
      const { result } = renderHook(
        () =>
          usePaymentStatus({
            user: USER,
            checkout: { checkout_id: 'checkout_abc', started_at: started },
          }),
        { wrapper },
      )
      await vi.advanceTimersByTimeAsync(0)
      expect(result.current.state).toBe('polling')

      // One second past the deadline while still pending → timeout, and the
      // interval stops (no more polling after the window).
      await vi.advanceTimersByTimeAsync(2_000)
      expect(result.current.state).toBe('timeout')
      const calls = hoisted.status.mock.calls.length
      await vi.advanceTimersByTimeAsync(60_000)
      expect(hoisted.status.mock.calls.length).toBe(calls)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not poll for guests', async () => {
    hoisted.status.mockResolvedValue(PENDING)
    const { result } = renderHook(
      () =>
        usePaymentStatus({
          user: null,
          checkout: { checkout_id: 'checkout_abc', started_at: STARTED_AT },
        }),
      { wrapper },
    )
    expect(result.current.state).toBe('polling')
    expect(hoisted.status).not.toHaveBeenCalled()
  })
})
