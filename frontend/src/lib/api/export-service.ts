import { HttpClient } from './http-client'
import type { CreditBalances } from './reveal-service'

export type ExportFormat = 'csv' | 'xlsx'

export type CreateExportResponse = {
  id: string
  format: ExportFormat
  row_count: number
  revealed_count: number
  unrevealed_count: number
  credits_cost: number
  included_unrevealed: boolean
  watermark: boolean
  created_at: string
  balances: CreditBalances
}

export type ExportApiError = {
  response?: { status?: number; data?: { code?: string } }
}

function isCodeError(
  error: unknown,
  status: number,
  code: string,
): error is ExportApiError & { response: { status: number } } {
  if (typeof error !== 'object' || error === null) return false
  const apiError = error as ExportApiError
  return (
    apiError.response?.status === status && apiError.response?.data?.code === code
  )
}

export function isExportLimitError(error: unknown): boolean {
  return isCodeError(error, 429, 'export_limit_exceeded')
}

export function isStarterOnlyError(error: unknown): boolean {
  return isCodeError(error, 403, 'starter_only')
}

export function isConcurrentExportError(error: unknown): boolean {
  return isCodeError(error, 409, 'concurrent_export')
}

export function isRecordNotFoundError(error: unknown): boolean {
  return isCodeError(error, 404, 'record_not_found')
}

export class ExportService extends HttpClient {
  async create(payload: {
    record_ids: string[]
    format: ExportFormat
    include_unrevealed: boolean
  }): Promise<CreateExportResponse> {
    const { data } = await this.client.post<CreateExportResponse>('/export/', payload)
    return data
  }
}

export const exportService = new ExportService()
