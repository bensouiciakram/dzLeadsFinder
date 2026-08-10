import type { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/emails/render/route'

function mockRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('POST /api/emails/render', () => {
  it('returns 200 for signup_confirm template', async () => {
    const response = await POST(mockRequest({
      template: 'signup_confirm',
      context: { verificationLink: 'https://example.com/verify' },
    }))
    expect(response.status).toBe(200)
  })

  it('returns 200 for payment_receipt template', async () => {
    const response = await POST(mockRequest({
      template: 'payment_receipt',
      context: { amount: 1500, creditsGranted: 200, date: '2025-01-01' },
    }))
    expect(response.status).toBe(200)
  })

  it('renders a localized arabic payment receipt (5.3)', async () => {
    const response = await POST(mockRequest({
      template: 'payment_receipt',
      locale: 'ar',
      context: { amount: 1500, creditsGranted: 200, date: '2025-01-01' },
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).toContain('تم استلام الدفع')
    expect(body.html).toContain('1,500')
  })

  it('renders the renewal variant of the receipt (5.3)', async () => {
    const response = await POST(mockRequest({
      template: 'payment_receipt',
      locale: 'en',
      context: {
        amount: 1500,
        creditsGranted: 200,
        date: '2025-01-01',
        isRenewal: true,
      },
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).toContain('200 fresh credits')
  })

  it('renders a localized french payment receipt (5.3)', async () => {
    const response = await POST(mockRequest({
      template: 'payment_receipt',
      locale: 'fr',
      context: { amount: 1500, creditsGranted: 200, date: '2025-01-01' },
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).toContain('Paiement reçu')
  })

  it('renders the pack variant of the receipt (5.4)', async () => {
    const response = await POST(mockRequest({
      template: 'payment_receipt',
      locale: 'en',
      context: { amount: 500, creditsGranted: 75, date: '2025-01-01', isPack: true },
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).toContain('Your one-time pack of 75 credits has been added')
    expect(body.html).toContain('never expire')
  })

  it('renders the localized arabic pack variant with bidi isolation (5.4)', async () => {
    const response = await POST(mockRequest({
      template: 'payment_receipt',
      locale: 'ar',
      context: { amount: 500, creditsGranted: 75, date: '2025-01-01', isPack: true },
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).toContain('<bdi>75</bdi>')
    expect(body.html).toContain('dir="rtl"')
  })

  it('renders 0 credits instead of NaN when creditsGranted is absent (E11)', async () => {
    const response = await POST(mockRequest({
      template: 'payment_receipt',
      locale: 'en',
      context: { amount: 500, date: '2025-01-01', isPack: true },
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).not.toContain('NaN')
  })

  it('returns 200 for low_credit template', async () => {
    const response = await POST(mockRequest({
      template: 'low_credit',
      context: { remainingCredits: 5, topUpLink: 'https://example.com/billing' },
    }))
    expect(response.status).toBe(200)
  })

  it('returns 200 for password_reset template and renders the link', async () => {
    const response = await POST(mockRequest({
      template: 'password_reset',
      locale: 'en',
      context: { resetLink: 'https://example.com/password-reset/abc' },
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).toContain('https://example.com/password-reset/abc')
  })

  it('returns 400 for unknown template', async () => {
    const response = await POST(mockRequest({
      template: 'nonexistent',
      context: {},
    }))
    expect(response.status).toBe(400)
  })

  it('returns 500 for missing body', async () => {
    const response = await POST(mockRequest(null))
    expect(response.status).toBe(500)
  })
})
