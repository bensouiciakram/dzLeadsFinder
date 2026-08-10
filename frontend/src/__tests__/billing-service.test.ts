import { describe, expect, it, vi } from 'vitest'

import {
  BillingService,
  formatBillingDate,
  isSubscriptionNotActiveError,
  isSubscriptionNotFoundError,
  numerals,
  type CancelResult,
  type HistoryResult,
  type HistoryRow,
  type PacksResult,
  type PlanResult,
} from '@/lib/api/billing-service'

describe('BillingService', () => {
  function stubGet(service: BillingService, response: unknown) {
    const getMock = vi.fn().mockResolvedValue({ data: response })
    ;(service as unknown as { client: { get: typeof getMock } }).client.get = getMock
    return getMock
  }

  function stubPost(service: BillingService, response: unknown) {
    const postMock = vi.fn().mockResolvedValue({ data: response })
    ;(service as unknown as { client: { post: typeof postMock } }).client.post = postMock
    return postMock
  }

  const PLAN: PlanResult = {
    tier: 'free',
    status: null,
    renews_on: null,
    balances: { subscription_balance: 0, pack_balance: 0, display_balance: 0 },
  }

  const PACKS: PacksResult = {
    packs: [
      {
        amount: 500,
        credits: 75,
        description: 'DZLeads Pack — 75 credits, never expires',
        unit_price: '6.7',
        never_expires: true,
        best_value: false,
      },
      {
        amount: 1500,
        credits: 250,
        description: 'DZLeads Pack — 250 credits, never expires',
        unit_price: '6.0',
        never_expires: true,
        best_value: true,
      },
    ],
    never_expires: true,
  }

  const HISTORY: HistoryResult = {
    results: [
      {
        id: 'txn-1',
        date: '2026-08-07T12:00:00+01:00',
        amount_dzd: 1500,
        type: 'subscription_creation',
        status: 'succeeded',
        credits_granted: 200,
      },
    ],
  }

  it('gets /billing/plan/ and returns the typed result', async () => {
    const service = new BillingService()
    const getMock = stubGet(service, PLAN)

    const result: PlanResult = await service.plan()

    expect(getMock).toHaveBeenCalledWith('/billing/plan/')
    expect(result).toEqual(PLAN)
  })

  it('gets /billing/packs/ and returns the typed result', async () => {
    const service = new BillingService()
    const getMock = stubGet(service, PACKS)

    const result: PacksResult = await service.packs()

    expect(getMock).toHaveBeenCalledWith('/billing/packs/')
    expect(result).toEqual(PACKS)
  })

  it('gets /billing/history/ and returns the typed result', async () => {
    const service = new BillingService()
    const getMock = stubGet(service, HISTORY)

    const result: HistoryResult = await service.history()

    expect(getMock).toHaveBeenCalledWith('/billing/history/')
    expect(result).toEqual(HISTORY)
  })

  it('posts /billing/cancel/ and returns the cancellation', async () => {
    const service = new BillingService()
    const postMock = stubPost(service, {
      status: 'cancelled',
      cancelled_at: '2026-08-10T12:00:00+01:00',
    })

    const result: CancelResult = await service.cancel()

    expect(postMock).toHaveBeenCalledWith('/billing/cancel/')
    expect(result).toEqual({ status: 'cancelled', cancelled_at: '2026-08-10T12:00:00+01:00' })
  })

  it('posts /billing/create-checkout/ with the type and amount', async () => {
    const service = new BillingService()
    const postMock = stubPost(service, {
      checkout_url: 'https://pay.chargily.com/checkout/1',
      checkout_id: 'chk-1',
    })

    const result = await service.createCheckout('subscription', 1500)

    expect(postMock).toHaveBeenCalledWith('/billing/create-checkout/', {
      type: 'subscription',
      amount: 1500,
    })
    expect(result).toEqual({
      checkout_url: 'https://pay.chargily.com/checkout/1',
      checkout_id: 'chk-1',
    })
  })

  it('passes pack amounts through', async () => {
    const service = new BillingService()
    const postMock = stubPost(service, {
      checkout_url: 'https://pay.chargily.com/checkout/2',
      checkout_id: 'chk-2',
    })

    await service.createCheckout('pack', 500)

    expect(postMock).toHaveBeenCalledWith('/billing/create-checkout/', {
      type: 'pack',
      amount: 500,
    })
  })

  it('pins the PlanResult shape to the backend exact keys', () => {
    expect(Object.keys(PLAN).sort()).toEqual(
      ['tier', 'status', 'renews_on', 'balances'].sort(),
    )
    expect(Object.keys(PLAN.balances).sort()).toEqual(
      ['subscription_balance', 'pack_balance', 'display_balance'].sort(),
    )
  })

  it('pins the Pack shape to the backend exact keys', () => {
    expect(Object.keys(PACKS.packs[0]).sort()).toEqual(
      ['amount', 'credits', 'description', 'unit_price', 'never_expires', 'best_value'].sort(),
    )
  })

  it('pins the HistoryRow shape to the backend exact keys', () => {
    const row: HistoryRow = HISTORY.results[0]
    expect(Object.keys(row).sort()).toEqual(
      ['id', 'date', 'amount_dzd', 'type', 'status', 'credits_granted'].sort(),
    )
  })

  describe('cancel error narrowing', () => {
    function codeError(status: number, code: string): unknown {
      return { response: { status, data: { code } } }
    }

    it('recognizes subscription_not_active', () => {
      expect(isSubscriptionNotActiveError(codeError(409, 'subscription_not_active'))).toBe(true)
      expect(isSubscriptionNotActiveError(codeError(409, 'subscription_not_found'))).toBe(false)
      expect(isSubscriptionNotActiveError(codeError(500, 'subscription_not_active'))).toBe(false)
      expect(isSubscriptionNotActiveError(null)).toBe(false)
    })

    it('recognizes subscription_not_found', () => {
      expect(isSubscriptionNotFoundError(codeError(409, 'subscription_not_found'))).toBe(true)
      expect(isSubscriptionNotFoundError(codeError(409, 'subscription_not_active'))).toBe(false)
      expect(isSubscriptionNotFoundError(codeError(500, 'subscription_not_found'))).toBe(false)
    })
  })

  describe('numerals', () => {
    it('formats with Western grouping in every locale (AD-8)', () => {
      expect(numerals(1500)).toBe('1,500')
      expect(numerals(75)).toBe('75')
      expect(numerals(0)).toBe('0')
    })
  })

  describe('formatBillingDate', () => {
    const value = '2026-08-07T12:00:00+01:00'

    it('formats medium date with latn numerals (the DangerZone precedent)', () => {
      const result = formatBillingDate(value, 'en', { withTime: false })
      expect(result).toMatch(/Aug/)
      expect(result).toMatch(/2026/)
    })

    it('adds the time for history cells (the CreditsPage formatTimestamp precedent)', () => {
      const result = formatBillingDate(value, 'en', { withTime: true })
      expect(result).toMatch(/Aug/)
      expect(result).toMatch(/12:00|13:00/)
    })

    it('forces Western numerals in ar (FR-15/AD-8)', () => {
      const result = formatBillingDate(value, 'ar', { withTime: false })
      expect(result).not.toMatch(/[٠-٩]/)
      expect(result).toMatch(/2026/)
    })

    it('falls back to the raw value on invalid input', () => {
      expect(formatBillingDate('not-a-date', 'en', { withTime: false })).toBe('not-a-date')
    })
  })
})
