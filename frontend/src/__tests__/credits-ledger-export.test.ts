import { describe, expect, it, vi } from 'vitest'

import type { LedgerResult, LedgerRow } from '@/lib/api/credits-service'
import { collectAllLedgerRows, LEDGER_PAGE_SIZE } from '@/lib/credits/ledger-export'

function row(id: string): LedgerRow {
  return {
    id,
    event_type: 'reveal_debit',
    amount: -1,
    balance_after: 10,
    reference_id: 'ref-' + id,
    created_at: '2026-08-07T12:00:00+01:00',
  }
}

function pageOf(ids: string[], total: number, page: number): LedgerResult {
  return { results: ids.map(row), total, page, truncated: false }
}

describe('collectAllLedgerRows', () => {
  it('walks every page until a short page and returns the full window', async () => {
    const fetchPage = vi
      .fn<(page: number) => Promise<LedgerResult>>()
      .mockResolvedValueOnce(pageOf(Array.from({ length: LEDGER_PAGE_SIZE }, (_, i) => `r${i}`), 55, 1))
      .mockResolvedValueOnce(pageOf(['r50', 'r51', 'r52', 'r53', 'r54'], 55, 2))

    const result = await collectAllLedgerRows(fetchPage)

    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2)
    expect(result.ok).toBe(true)
    expect(result.ok && result.rows.map((r) => r.id)).toEqual([
      ...Array.from({ length: LEDGER_PAGE_SIZE }, (_, i) => `r${i}`),
      'r50',
      'r51',
      'r52',
      'r53',
      'r54',
    ])
  })

  it('dedupes rows duplicated across pages by offset-pagination drift', async () => {
    // Page 1 is FULL size and ends with two rows that page 2 repeats
    // (a grant landing between fetches shifted the offsets).
    const pageOneIds = [
      ...Array.from({ length: LEDGER_PAGE_SIZE - 2 }, (_, i) => `u${i}`),
      'dup-1',
      'dup-2',
    ]
    const fetchPage = vi
      .fn<(page: number) => Promise<LedgerResult>>()
      .mockResolvedValueOnce(pageOf(pageOneIds, LEDGER_PAGE_SIZE + 2, 1))
      .mockResolvedValueOnce(pageOf(['dup-1', 'dup-2', 'new-1', 'new-2'], LEDGER_PAGE_SIZE + 2, 2))

    const result = await collectAllLedgerRows(fetchPage)

    expect(result.ok).toBe(true)
    expect(result.ok && result.rows.map((r) => r.id)).toEqual([
      ...Array.from({ length: LEDGER_PAGE_SIZE - 2 }, (_, i) => `u${i}`),
      'dup-1',
      'dup-2',
      'new-1',
      'new-2',
    ])
  })

  it('stops immediately on an empty first page (headers-only export)', async () => {
    const fetchPage = vi
      .fn<(page: number) => Promise<LedgerResult>>()
      .mockResolvedValue(pageOf([], 0, 1))

    const result = await collectAllLedgerRows(fetchPage)

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true, rows: [] })
  })

  it('refuses the export when the ledger shrank mid-walk', async () => {
    // Page 1 reports total=3 but the short page 2 only surfaces one row —
    // a row rolled out of the window between fetches.
    const fetchPage = vi
      .fn<(page: number) => Promise<LedgerResult>>()
      .mockResolvedValueOnce(pageOf(['a', 'b'], 3, 1))
      .mockResolvedValueOnce(pageOf(['c'], 3, 2))

    const result = await collectAllLedgerRows(fetchPage)

    expect(result).toEqual({ ok: false, reason: 'shrank' })
  })

  it('maps a network failure to the failed reason instead of throwing', async () => {
    const fetchPage = vi.fn<(page: number) => Promise<LedgerResult>>().mockRejectedValue(new Error('boom'))

    const result = await collectAllLedgerRows(fetchPage)

    expect(result).toEqual({ ok: false, reason: 'failed' })
  })
})
