import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCheckoutRedirect } from '@/hooks/useCheckoutRedirect'
import {
  PENDING_CHECKOUT_KEY,
  readPendingCheckout,
} from '@/lib/billing/checkoutStorage'

const hoisted = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  assign: vi.fn(),
}))

vi.mock('@/lib/api/billing-service', () => ({
  billingService: {
    createCheckout: hoisted.createCheckout,
  },
}))

vi.mock('@/lib/api/http-client', () => ({
  navigator: { assign: hoisted.assign },
}))

const CHECKOUT = {
  checkout_url: 'https://pay.chargily.com/checkout/abc',
  checkout_id: 'checkout_abc',
  started_at: '2026-08-11T12:00:00+01:00',
}

beforeEach(() => {
  hoisted.createCheckout.mockReset()
  hoisted.assign.mockReset()
  window.sessionStorage.clear()
})

describe('useCheckoutRedirect', () => {
  it('stashes the pending checkout in sessionStorage before leaving', async () => {
    hoisted.createCheckout.mockResolvedValue(CHECKOUT)

    const { result } = renderHook(() => useCheckoutRedirect())

    await act(async () => {
      await result.current.redirect('pack', 500)
    })

    expect(hoisted.assign).toHaveBeenCalledWith(CHECKOUT.checkout_url)
    const stash = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)
    expect(stash).not.toBeNull()
    expect(JSON.parse(stash as string)).toEqual({
      checkout_id: 'checkout_abc',
      started_at: '2026-08-11T12:00:00+01:00',
    })
  })

  it('a later mount can read the pending checkout back (the return round-trip)', () => {
    window.sessionStorage.setItem(
      PENDING_CHECKOUT_KEY,
      JSON.stringify({ checkout_id: 'checkout_abc', started_at: CHECKOUT.started_at }),
    )
    expect(readPendingCheckout()).toEqual({
      checkout_id: 'checkout_abc',
      started_at: CHECKOUT.started_at,
    })
  })

  it('rejects a stash with an unparseable started_at (review P2)', () => {
    // A NaN deadline would spin the poll forever — the storage layer must
    // refuse it so the hook never sees it.
    window.sessionStorage.setItem(
      PENDING_CHECKOUT_KEY,
      JSON.stringify({ checkout_id: 'checkout_abc', started_at: 'not-a-date' }),
    )
    expect(readPendingCheckout()).toBeNull()
    expect(window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)).toBeNull()
  })

  it('rejects a stash with an empty checkout_id (review P2)', () => {
    window.sessionStorage.setItem(
      PENDING_CHECKOUT_KEY,
      JSON.stringify({ checkout_id: '', started_at: CHECKOUT.started_at }),
    )
    expect(readPendingCheckout()).toBeNull()
  })

  it('does not stash on a failed checkout creation', async () => {
    hoisted.createCheckout.mockRejectedValue(new Error('chargily down'))

    const { result } = renderHook(() => useCheckoutRedirect())

    await act(async () => {
      await result.current.redirect('pack', 500)
    })

    expect(result.current.error).toBe(true)
    expect(window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)).toBeNull()
    expect(hoisted.assign).not.toHaveBeenCalled()
  })

  it('clears the stash when the navigation itself throws (review P7)', async () => {
    hoisted.createCheckout.mockResolvedValue(CHECKOUT)
    hoisted.assign.mockImplementation(() => {
      throw new Error('navigation blocked')
    })

    const { result } = renderHook(() => useCheckoutRedirect())

    await act(async () => {
      await result.current.redirect('pack', 500)
    })

    expect(result.current.error).toBe(true)
    // No orphan stash — a later /billing visit must not poll a checkout
    // that never began.
    expect(window.sessionStorage.getItem(PENDING_CHECKOUT_KEY)).toBeNull()
  })

  it('keeps an existing stash when a second checkout starts (two-tab V1 limitation)', async () => {
    hoisted.createCheckout.mockResolvedValue({ ...CHECKOUT, checkout_id: 'checkout_2' })

    const { result } = renderHook(() => useCheckoutRedirect())

    await act(async () => {
      await result.current.redirect('subscription', 1500)
    })

    const stash = JSON.parse(
      window.sessionStorage.getItem(PENDING_CHECKOUT_KEY) as string,
    )
    expect(stash.checkout_id).toBe('checkout_2')
    expect(stash.started_at).toBe(CHECKOUT.started_at)
  })
})
