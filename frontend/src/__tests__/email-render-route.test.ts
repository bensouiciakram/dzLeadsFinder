import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/emails/render/route'

function mockRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as unknown as Request
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

  it('returns 200 for pack_receipt template', async () => {
    const response = await POST(mockRequest({
      template: 'pack_receipt',
      context: { packCredits: 75, amount: 500 },
    }))
    expect(response.status).toBe(200)
  })

  it('returns 200 for low_credit template', async () => {
    const response = await POST(mockRequest({
      template: 'low_credit',
      context: { remainingCredits: 5, topUpLink: 'https://example.com/billing' },
    }))
    expect(response.status).toBe(200)
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
