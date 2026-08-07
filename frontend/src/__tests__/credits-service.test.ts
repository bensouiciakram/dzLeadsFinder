import { describe, expect, it, vi } from 'vitest'

import { CreditsService, type LedgerResult, type LedgerRow } from '@/lib/api/credits-service'

describe('CreditsService', () => {
  function stubClient(service: CreditsService, response: unknown) {
    const getMock = vi.fn().mockResolvedValue({ data: response })
    ;(service as unknown as { client: { get: typeof getMock } }).client.get = getMock
    return getMock
  }

  const ROW: LedgerRow = {
    id: 'row-1',
    event_type: 'free_signup',
    amount: 15,
    balance_after: 15,
    reference_id: null,
    created_at: '2026-08-07T12:00:00+01:00',
  }

  const RESULT: LedgerResult = {
    results: [ROW],
    total: 1,
    page: 1,
    truncated: false,
  }

  it('gets /credits/ledger/ with the page param and returns the typed result', async () => {
    const service = new CreditsService()
    const getMock = stubClient(service, RESULT)

    const result: LedgerResult = await service.ledger(1)

    expect(getMock).toHaveBeenCalledWith('/credits/ledger/', { params: { page: 1 } })
    expect(result).toEqual(RESULT)
  })

  it('passes the requested page through', async () => {
    const service = new CreditsService()
    const getMock = stubClient(service, { ...RESULT, page: 3 })

    await service.ledger(3)

    expect(getMock).toHaveBeenCalledWith('/credits/ledger/', { params: { page: 3 } })
  })

  it('pins the LedgerRow shape to the backend exact keys', () => {
    const row: LedgerRow = {
      id: 'x',
      event_type: 'reveal_debit',
      amount: -1,
      balance_after: 14,
      reference_id: 'ref-1',
      created_at: '2026-08-07T12:00:00Z',
    }
    expect(Object.keys(row).sort()).toEqual(
      ['id', 'event_type', 'amount', 'balance_after', 'reference_id', 'created_at'].sort(),
    )
    expect(row.event_type).toBe('reveal_debit')
  })
})
