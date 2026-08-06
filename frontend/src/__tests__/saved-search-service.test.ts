import axios from 'axios'
import type {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { SavedSearchService } from '@/lib/api/saved-search-service'

function stubClient(service: SavedSearchService, response: unknown) {
  const method = vi.fn().mockResolvedValue({ data: response })
  ;(service as unknown as { client: { get: typeof method } }).client.get = method
  return method
}

function stubPost(service: SavedSearchService, response: unknown) {
  const method = vi.fn().mockResolvedValue({ data: response })
  ;(service as unknown as { client: { post: typeof method } }).client.post = method
  return method
}

function stubPut(service: SavedSearchService, response: unknown) {
  const method = vi.fn().mockResolvedValue({ data: response })
  ;(service as unknown as { client: { put: typeof method } }).client.put = method
  return method
}

function stubDelete(service: SavedSearchService, response: unknown) {
  const method = vi.fn().mockResolvedValue({ data: response })
  ;(service as unknown as { client: { delete: typeof method } }).client.delete = method
  return method
}

const ROW = {
  id: '9f5c4f88-6f21-4a22-b4e2-123456789abc',
  name: 'Importers Oran',
  type: 'people',
  filters: { industry: [2], wilaya: [31], keyword: 'textile' },
  sort: { field: 'role', dir: 'desc' },
  created_at: '2026-08-06T00:00:00Z',
  updated_at: '2026-08-06T00:00:00Z',
}

describe('SavedSearchService', () => {
  it('lists saved searches from the prefix-relative path', async () => {
    const service = new SavedSearchService()
    const getMock = stubClient(service, [ROW])

    const result = await service.list()

    expect(getMock).toHaveBeenCalledWith('/search/saved/')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Importers Oran')
    expect(result[0].sort).toEqual({ field: 'role', dir: 'desc' })
  })

  it('creates a saved search with the full payload', async () => {
    const service = new SavedSearchService()
    const postMock = stubPost(service, ROW)

    const payload = {
      name: 'Importers Oran',
      type: 'people' as const,
      filters: { industry: [2], wilaya: [31], keyword: 'textile' },
      sort: { field: 'role', dir: 'desc' } as const,
    }
    const result = await service.create(payload)

    expect(postMock).toHaveBeenCalledWith('/search/saved/', payload)
    expect(result.id).toBe(ROW.id)
  })

  it('renames a saved search by id', async () => {
    const service = new SavedSearchService()
    const putMock = stubPut(service, { ...ROW, name: 'New name' })

    const result = await service.rename(ROW.id, 'New name')

    expect(putMock).toHaveBeenCalledWith(`/search/saved/${ROW.id}/`, { name: 'New name' })
    expect(result.name).toBe('New name')
  })

  it('deletes a saved search by id', async () => {
    const service = new SavedSearchService()
    const deleteMock = stubDelete(service, {})

    await service.remove(ROW.id)

    expect(deleteMock).toHaveBeenCalledWith(`/search/saved/${ROW.id}/`)
  })

  it('never double-prefixes the API base URL (real axios merge guard)', async () => {
    const urls: string[] = []
    const adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      urls.push(axios.getUri({ baseURL: config.baseURL, url: config.url }))
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }
    const service = new SavedSearchService({ adapter } as AxiosRequestConfig)

    await service.list()
    await service.create({
      name: 'x',
      type: 'people',
      filters: {},
      sort: null,
    })
    await service.rename(ROW.id, 'y')
    await service.remove(ROW.id)

    expect(urls).toEqual([
      '/api/search/saved/',
      '/api/search/saved/',
      `/api/search/saved/${ROW.id}/`,
      `/api/search/saved/${ROW.id}/`,
    ])
    for (const url of urls) {
      expect(url.startsWith('/api/')).toBe(true)
      expect(url).not.toContain('/api/api/')
    }
  })
})
