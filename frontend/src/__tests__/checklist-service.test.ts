import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import {
  ChecklistService,
  completedSteps,
  type ChecklistState,
} from '@/lib/api/checklist-service'

const STATE: ChecklistState = {
  step_search: false,
  step_reveal: false,
  step_export: false,
  dismissed: false,
}

function stubGet(service: ChecklistService, response: unknown) {
  const method = vi.fn().mockResolvedValue({ data: response })
  ;(service as unknown as { client: { get: typeof method } }).client.get = method
  return method
}

function stubPut(service: ChecklistService, response: unknown) {
  const method = vi.fn().mockResolvedValue({ data: response })
  ;(service as unknown as { client: { put: typeof method } }).client.put = method
  return method
}

describe('ChecklistService', () => {
  it('fetches the checklist state from the prefix-relative path', async () => {
    const service = new ChecklistService()
    const getMock = stubGet(service, STATE)

    const result = await service.get()

    expect(getMock).toHaveBeenCalledWith('/search/checklist/')
    expect(result).toEqual(STATE)
  })

  it('dismisses via PUT with the exact payload', async () => {
    const service = new ChecklistService()
    const putMock = stubPut(service, { ...STATE, dismissed: true })

    const result = await service.dismiss()

    expect(putMock).toHaveBeenCalledWith('/search/checklist/', { dismissed: true })
    expect(result.dismissed).toBe(true)
  })

  it('never double-prefixes the API base URL (real axios merge guard)', async () => {
    const urls: string[] = []
    const adapter = async (
      config: InternalAxiosRequestConfig,
    ): Promise<AxiosResponse> => {
      urls.push(axios.getUri({ baseURL: config.baseURL, url: config.url }))
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }
    const service = new ChecklistService({ adapter } as AxiosRequestConfig)

    await service.get()
    await service.dismiss()

    expect(urls).toEqual(['/api/search/checklist/', '/api/search/checklist/'])
    for (const url of urls) {
      expect(url.startsWith('/api/')).toBe(true)
      expect(url).not.toContain('/api/api/')
    }
  })
})

describe('completedSteps', () => {
  it('returns empty for a fresh state', () => {
    expect(
      completedSteps({ step_search: false, step_reveal: false, step_export: false, dismissed: false }),
    ).toEqual([])
  })

  it('returns all three when complete', () => {
    expect(
      completedSteps({ step_search: true, step_reveal: true, step_export: true, dismissed: false }),
    ).toEqual(['search', 'reveal', 'export'])
  })

  it('returns the mixed subset in AC order', () => {
    expect(
      completedSteps({ step_search: true, step_reveal: false, step_export: true, dismissed: false }),
    ).toEqual(['search', 'export'])
  })

  it('ignores the dismissed flag', () => {
    expect(
      completedSteps({ step_search: true, step_reveal: false, step_export: false, dismissed: true }),
    ).toEqual(['search'])
  })
})
