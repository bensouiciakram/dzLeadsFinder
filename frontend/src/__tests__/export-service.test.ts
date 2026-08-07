import { describe, expect, it, vi } from 'vitest'

import {
  ExportService,
  isConcurrentExportError,
  isExportLimitError,
  isRecordNotFoundError,
  isStarterOnlyError,
  type CreateExportResponse,
} from '@/lib/api/export-service'
import { isInsufficientCreditsError } from '@/lib/api/reveal-service'

const BALANCES = {
  subscription_balance: 12,
  pack_balance: 0,
  display_balance: 12,
}

const RESPONSE = {
  id: '11111111-2222-3333-4444-555555555555',
  format: 'csv',
  row_count: 3,
  revealed_count: 2,
  unrevealed_count: 1,
  credits_cost: 3,
  included_unrevealed: true,
  watermark: false,
  created_at: '2026-08-07T12:00:00Z',
  balances: BALANCES,
} satisfies CreateExportResponse

describe('ExportService', () => {
  function stubClient(service: ExportService, response: unknown) {
    const postMock = vi.fn().mockResolvedValue({ data: response })
    ;(service as unknown as { client: { post: typeof postMock } }).client.post = postMock
    return postMock
  }

  it('posts the exact 4.4 payload to /export/', async () => {
    const service = new ExportService()
    const postMock = stubClient(service, RESPONSE)

    const result = await service.create({
      record_ids: ['p-1', 'p-2', 'p-3'],
      format: 'csv',
      include_unrevealed: true,
    })

    expect(postMock).toHaveBeenCalledWith('/export/', {
      record_ids: ['p-1', 'p-2', 'p-3'],
      format: 'csv',
      include_unrevealed: true,
    })
    expect(result).toEqual(RESPONSE)
  })

  it('passes the format and include_unrevealed through unchanged', async () => {
    const service = new ExportService()
    const postMock = stubClient(service, { ...RESPONSE, format: 'xlsx' })

    await service.create({
      record_ids: ['c-1'],
      format: 'xlsx',
      include_unrevealed: false,
    })

    expect(postMock).toHaveBeenCalledWith('/export/', {
      record_ids: ['c-1'],
      format: 'xlsx',
      include_unrevealed: false,
    })
  })
})

describe('export error guards', () => {
  it('isExportLimitError recognizes 429 export_limit_exceeded', () => {
    const error = { response: { status: 429, data: { code: 'export_limit_exceeded' } } }
    expect(isExportLimitError(error)).toBe(true)
    expect(isExportLimitError({ response: { status: 429, data: { code: 'other' } } })).toBe(false)
    expect(isExportLimitError({ response: { status: 400, data: { code: 'export_limit_exceeded' } } })).toBe(
      false,
    )
    expect(isExportLimitError(new Error('boom'))).toBe(false)
  })

  it('isStarterOnlyError recognizes 403 starter_only', () => {
    const error = { response: { status: 403, data: { code: 'starter_only' } } }
    expect(isStarterOnlyError(error)).toBe(true)
    expect(isStarterOnlyError({ response: { status: 403, data: { code: 'other' } } })).toBe(false)
    expect(isStarterOnlyError({ response: { status: 402, data: { code: 'starter_only' } } })).toBe(false)
  })

  it('isConcurrentExportError recognizes 409 concurrent_export', () => {
    const error = { response: { status: 409, data: { code: 'concurrent_export' } } }
    expect(isConcurrentExportError(error)).toBe(true)
    expect(isConcurrentExportError({ response: { status: 409, data: {} } })).toBe(false)
  })

  it('isRecordNotFoundError recognizes 404 record_not_found', () => {
    const error = { response: { status: 404, data: { code: 'record_not_found' } } }
    expect(isRecordNotFoundError(error)).toBe(true)
    expect(isRecordNotFoundError({ response: { status: 404, data: { code: 'other' } } })).toBe(false)
  })

  it('reuses the reveal-service 402 guard (never duplicated)', () => {
    const error = { response: { status: 402, data: { code: 'insufficient_credits' } } }
    expect(isInsufficientCreditsError(error)).toBe(true)
  })
})
