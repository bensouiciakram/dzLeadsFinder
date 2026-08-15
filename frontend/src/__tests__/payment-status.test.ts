import { describe, expect, it } from 'vitest'

import { PAYMENT_POLL_DEADLINE_MS } from '@/lib/api/billing-service'
import { classifyPaymentStatus } from '@/lib/billing/payment-status'

const STARTED_AT = '2026-08-15T10:00:00.000Z'
const START_MS = new Date(STARTED_AT).getTime()

describe('classifyPaymentStatus (M14 pure logic)', () => {
  it('returns polling before the deadline while the status is pending', () => {
    expect(classifyPaymentStatus(undefined, STARTED_AT, START_MS + 1_000)).toBe('polling')
    expect(classifyPaymentStatus('pending', STARTED_AT, START_MS + 30_000)).toBe('polling')
  })

  it('flips to timeout at the deadline', () => {
    expect(
      classifyPaymentStatus('pending', STARTED_AT, START_MS + PAYMENT_POLL_DEADLINE_MS),
    ).toBe('timeout')
    expect(
      classifyPaymentStatus('pending', STARTED_AT, START_MS + PAYMENT_POLL_DEADLINE_MS + 1),
    ).toBe('timeout')
  })

  it('terminal statuses win over the deadline', () => {
    expect(
      classifyPaymentStatus('succeeded', STARTED_AT, START_MS + PAYMENT_POLL_DEADLINE_MS + 60_000),
    ).toBe('success')
    expect(
      classifyPaymentStatus('failed', STARTED_AT, START_MS + PAYMENT_POLL_DEADLINE_MS + 60_000),
    ).toBe('failed')
    expect(
      classifyPaymentStatus('refunded', STARTED_AT, START_MS + PAYMENT_POLL_DEADLINE_MS + 60_000),
    ).toBe('failed')
  })

  it('treats a NaN deadline as passed (no infinite polling)', () => {
    expect(classifyPaymentStatus('pending', 'not-a-date', Date.now())).toBe('timeout')
  })

  it('never times out without a checkout (no deadline)', () => {
    expect(classifyPaymentStatus(undefined, null, Date.now())).toBe('polling')
    expect(classifyPaymentStatus('succeeded', null, Date.now())).toBe('success')
  })
})