import { HttpClient } from './http-client'

export type SavedSearchType = 'people' | 'company'

export type SavedSearchSort = {
  field: string
  dir: 'asc' | 'desc' | null
}

export function savedTypeToTab(type: SavedSearchType): 'people' | 'companies' {
  return type === 'company' ? 'companies' : 'people'
}

export function tabToSavedType(tab: 'people' | 'companies'): SavedSearchType {
  return tab === 'companies' ? 'company' : 'people'
}

export type SavedSearchRow = {
  id: string
  name: string
  type: SavedSearchType
  filters: Record<string, unknown>
  sort: SavedSearchSort | null
  created_at: string
  updated_at: string
}

export type SavedSearchPayload = {
  name: string
  type: SavedSearchType
  filters: Record<string, unknown>
  sort: SavedSearchSort | null
}

// The search that was actually executed (type + payload + sort), used both
// as the save-request body source and the "currently active" highlight key.
export type SavedSearchSnapshot = {
  type: SavedSearchType
  filters: Record<string, unknown>
  sort: SavedSearchSort | null
}

type SavedSearchApiError = {
  response?: {
    status?: number
    data?: { detail?: string; code?: string; limit?: number }
  }
}

export function isSavedSearchLimitError(
  error: unknown,
): error is SavedSearchApiError & { response: { status: 400; data: { code: string } } } {
  if (typeof error !== 'object' || error === null) return false
  const response = (error as SavedSearchApiError).response
  return response?.status === 400 && response.data?.code === 'saved_search_limit_exceeded'
}

export class SavedSearchService extends HttpClient {
  async list(): Promise<SavedSearchRow[]> {
    const { data } = await this.client.get<SavedSearchRow[]>('/search/saved/')
    return data
  }

  async create(payload: SavedSearchPayload): Promise<SavedSearchRow> {
    const { data } = await this.client.post<SavedSearchRow>('/search/saved/', payload)
    return data
  }

  async rename(id: string, name: string): Promise<SavedSearchRow> {
    const { data } = await this.client.put<SavedSearchRow>(`/search/saved/${id}/`, { name })
    return data
  }

  async remove(id: string): Promise<void> {
    await this.client.delete(`/search/saved/${id}/`)
  }
}

export const savedSearchService = new SavedSearchService()
