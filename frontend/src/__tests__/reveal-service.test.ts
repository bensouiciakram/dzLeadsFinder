import { describe, expect, it, vi } from 'vitest'

import {
  RevealService,
  isInsufficientCreditsError,
  type CompanyContact,
  type CreditBalances,
  type PeopleContact,
  type RevealResult,
} from '@/lib/api/reveal-service'

describe('RevealService', () => {
  function stubClient(service: RevealService, response: unknown) {
    const postMock = vi.fn().mockResolvedValue({ data: response })
    ;(service as unknown as { client: { post: typeof postMock } }).client.post = postMock
    return postMock
  }

  const BALANCES: CreditBalances = {
    subscription_balance: 2,
    pack_balance: 0,
    display_balance: 2,
  }

  it('posts /reveal/people/{id}/ and returns the typed reveal result', async () => {
    const service = new RevealService()
    const contact: PeopleContact = {
      record_type: 'people',
      record_id: 'abc',
      name: 'Karim Benali',
      role: 'CEO',
      company_name: 'ACME Algérie',
      email: 'karim@acme.dz',
      phone: '0550 12 34 56',
      address: 'Alger Centre, Alger',
    }
    const postMock = stubClient(service, { contact, balances: BALANCES })

    const result: RevealResult = await service.reveal('people', 'abc')

    expect(postMock).toHaveBeenCalledWith('/reveal/people/abc/')
    expect(result.contact).toEqual(contact)
    expect(result.balances).toEqual(BALANCES)
  })

  it('posts /reveal/company/{id}/ with the company contact shape', async () => {
    const service = new RevealService()
    const contact: CompanyContact = {
      record_type: 'company',
      record_id: 'def',
      name: 'ACME Algérie',
      industry: 'Construction',
      website: 'https://acme.dz',
      wilaya_code: 31,
      size_band: '11-50',
    }
    const postMock = stubClient(service, { contact, balances: BALANCES })

    const result = await service.reveal('company', 'def')

    expect(postMock).toHaveBeenCalledWith('/reveal/company/def/')
    expect(result.contact).toEqual(contact)
  })
})

describe('isInsufficientCreditsError', () => {
  it('recognizes a 402 with the insufficient_credits code', () => {
    const error = { response: { status: 402, data: { code: 'insufficient_credits' } } }
    expect(isInsufficientCreditsError(error)).toBe(true)
  })

  it('rejects other statuses and codes', () => {
    expect(
      isInsufficientCreditsError({ response: { status: 404, data: { code: 'record_not_found' } } }),
    ).toBe(false)
    expect(isInsufficientCreditsError({ response: { status: 402, data: {} } })).toBe(false)
    expect(isInsufficientCreditsError(null)).toBe(false)
    expect(isInsufficientCreditsError(new Error('boom'))).toBe(false)
  })
})
