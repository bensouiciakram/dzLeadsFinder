import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { exportService } from '@/lib/api/export-service'
import type { CreateExportResponse } from '@/lib/api/export-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'
import { useExport } from '@/hooks/useExport'

const creditsMock = vi.hoisted(() => ({
  balance: 15,
  applyCreditDelta: vi.fn(),
  applyConfirmedBalance: vi.fn(),
}))

vi.mock('@/components/providers/CreditProvider', () => ({
  useCredits: () => creditsMock,
}))

vi.mock('@/lib/api/export-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/export-service')>()
  return {
    ...actual,
    exportService: { create: vi.fn() },
  }
})

const BALANCES = {
  subscription_balance: 12,
  pack_balance: 0,
  display_balance: 12,
}

const RESULT: CreateExportResponse = {
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
}

const PAYLOAD = {
  record_ids: ['p-1', 'p-2', 'p-3'],
  format: 'csv' as const,
  include_unrevealed: true,
}

function deferredResult<T>(value: T) {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function apiError(status: number, code: string) {
  return { response: { status, data: { code } } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useExport', () => {
  it('reports pending while the mutation is in flight and clears it on success', async () => {
    const client = freshClient()
    const deferred = deferredResult(RESULT)
    vi.mocked(exportService.create).mockReturnValue(deferred.promise)
    const { result } = renderHook(() => useExport({}), { wrapper: wrapperFor(client) })

    result.current.create(PAYLOAD)
    await waitFor(() => expect(result.current.isPending).toBe(true))

    deferred.resolve(RESULT)
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.error).toBeUndefined()
  })

  it('applies the confirmed balance and invalidates the checklist prefix on success (3.7 contract)', async () => {
    const client = freshClient()
    vi.mocked(exportService.create).mockResolvedValue(RESULT)
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useExport({}), { wrapper: wrapperFor(client) })

    result.current.create(PAYLOAD)

    await waitFor(() => expect(creditsMock.applyConfirmedBalance).toHaveBeenCalledWith(BALANCES))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: checklistKeys.all })
  })

  it('forwards the full result to the onSuccess callback', async () => {
    const client = freshClient()
    vi.mocked(exportService.create).mockResolvedValue(RESULT)
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useExport({ onSuccess }), { wrapper: wrapperFor(client) })

    result.current.create(PAYLOAD)

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(RESULT))
  })

  it('narrows each API failure into the ExportError union', async () => {
    const cases: Array<[unknown, string]> = [
      [apiError(429, 'export_limit_exceeded'), 'limit'],
      [apiError(402, 'insufficient_credits'), 'credits'],
      [apiError(403, 'starter_only'), 'starter'],
      [apiError(404, 'record_not_found'), 'generic'],
      [apiError(400, 'invalid_payload'), 'generic'],
      [apiError(409, 'concurrent_export'), 'concurrent'],
      [new Error('network down'), 'generic'],
    ]
    for (const [error, expected] of cases) {
      const client = freshClient()
      vi.mocked(exportService.create).mockRejectedValue(error)
      const { result } = renderHook(() => useExport({}), { wrapper: wrapperFor(client) })

      result.current.create(PAYLOAD)

      await waitFor(() => expect(result.current.error).toBe(expected))
    }
  })

  it('does not call applyConfirmedBalance or invalidate on failure', async () => {
    const client = freshClient()
    vi.mocked(exportService.create).mockRejectedValue(apiError(402, 'insufficient_credits'))
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useExport({}), { wrapper: wrapperFor(client) })

    result.current.create(PAYLOAD)

    await waitFor(() => expect(result.current.error).toBe('credits'))
    expect(creditsMock.applyConfirmedBalance).not.toHaveBeenCalled()
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: checklistKeys.all })
  })

  it('ignores a second create while one is in flight (double-submit guard)', async () => {
    const client = freshClient()
    const deferred = deferredResult(RESULT)
    vi.mocked(exportService.create).mockReturnValue(deferred.promise)
    const { result } = renderHook(() => useExport({}), { wrapper: wrapperFor(client) })

    result.current.create(PAYLOAD)
    result.current.create(PAYLOAD)
    result.current.create(PAYLOAD)

    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(vi.mocked(exportService.create)).toHaveBeenCalledTimes(1)

    deferred.resolve(RESULT)
    await waitFor(() => expect(result.current.isPending).toBe(false))
  })

  it('clears the error state on the next create attempt', async () => {
    const client = freshClient()
    vi.mocked(exportService.create)
      .mockRejectedValueOnce(apiError(429, 'export_limit_exceeded'))
      .mockResolvedValueOnce(RESULT)
    const { result } = renderHook(() => useExport({}), { wrapper: wrapperFor(client) })

    result.current.create(PAYLOAD)
    await waitFor(() => expect(result.current.error).toBe('limit'))

    result.current.create(PAYLOAD)
    await waitFor(() => expect(result.current.error).toBeUndefined())
    expect(result.current.isPending).toBe(false)
  })

  it('reset clears the error and re-arms the in-flight guard (modal re-open contract)', async () => {
    const client = freshClient()
    vi.mocked(exportService.create)
      .mockRejectedValueOnce(apiError(429, 'export_limit_exceeded'))
      .mockResolvedValueOnce(RESULT)
    const { result } = renderHook(() => useExport({}), { wrapper: wrapperFor(client) })

    result.current.create(PAYLOAD)
    await waitFor(() => expect(result.current.error).toBe('limit'))

    result.current.reset()
    await waitFor(() => expect(result.current.error).toBeUndefined())

    result.current.create(PAYLOAD)
    await waitFor(() => expect(result.current.error).toBeUndefined())
    expect(vi.mocked(exportService.create)).toHaveBeenCalledTimes(2)
  })
})
