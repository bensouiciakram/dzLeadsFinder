import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { checklistService } from '@/lib/api/checklist-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'
import { useChecklist } from '@/hooks/useChecklist'
import { useChecklistMutations } from '@/hooks/useChecklistMutations'
import type { ChecklistState } from '@/lib/api/checklist-service'

vi.mock('@/lib/api/checklist-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/checklist-service')>()
  return {
    ...actual,
    checklistService: {
      get: vi.fn(),
      dismiss: vi.fn(),
    },
  }
})

const USER = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: null,
}

const FRESH: ChecklistState = {
  step_search: false,
  step_reveal: false,
  step_export: false,
  dismissed: false,
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useChecklist', () => {
  it('fetches the state when the user is authenticated', async () => {
    vi.mocked(checklistService.get).mockResolvedValue(FRESH)
    const client = freshClient()
    const { result } = renderHook(() => useChecklist({ user: USER }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(checklistService.get).toHaveBeenCalledTimes(1)
    expect(result.current.state).toEqual(FRESH)
    expect(result.current.completed).toEqual([])
  })

  it('does not fetch for guests and reports idle, not loading', () => {
    const client = freshClient()
    const { result } = renderHook(() => useChecklist({ user: null }), {
      wrapper: wrapperFor(client),
    })

    expect(checklistService.get).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('idle')
  })

  it('surfaces the error phase with a retry', async () => {
    vi.mocked(checklistService.get).mockRejectedValueOnce(new Error('boom'))
    const client = freshClient()
    const { result } = renderHook(() => useChecklist({ user: USER }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('error'))
    vi.mocked(checklistService.get).mockResolvedValue(FRESH)
    result.current.refetch()
    await waitFor(() => expect(result.current.phase).toBe('success'))
  })

  it('derives the completed list from the state', async () => {
    vi.mocked(checklistService.get).mockResolvedValue({
      ...FRESH,
      step_search: true,
      step_export: true,
    })
    const client = freshClient()
    const { result } = renderHook(() => useChecklist({ user: USER }), {
      wrapper: wrapperFor(client),
    })

    await waitFor(() => expect(result.current.phase).toBe('success'))
    expect(result.current.completed).toEqual(['search', 'export'])
  })

  it('scopes the state query key to the user email', async () => {
    vi.mocked(checklistService.get).mockResolvedValue(FRESH)
    const client = freshClient()
    const { result } = renderHook(() => useChecklist({ user: USER }), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(result.current.phase).toBe('success'))
    const cache = client.getQueryCache().getAll()
    expect(cache.some((entry) => entry.queryKey[2] === 'a@b.dz')).toBe(true)
  })
})

describe('useChecklistMutations', () => {
  it('invalidates the checklist factory prefix after a dismiss', async () => {
    vi.mocked(checklistService.dismiss).mockResolvedValue({ ...FRESH, dismissed: true })
    const client = freshClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChecklistMutations(), {
      wrapper: wrapperFor(client),
    })

    await result.current.dismiss.mutateAsync()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: checklistKeys.all })
  })
})
