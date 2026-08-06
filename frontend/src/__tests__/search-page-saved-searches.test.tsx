import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchPage } from '@/components/search/SearchPage'
import { buildFiltersPayload, type SearchResult } from '@/lib/api/search-service'
import type { SavedSearchRow } from '@/lib/api/saved-search-service'

const hoisted = vi.hoisted(() => ({
  searchPeople: vi.fn(),
  searchCompanies: vi.fn(),
  savedList: vi.fn(),
  savedCreate: vi.fn(),
  savedRename: vi.fn(),
  savedRemove: vi.fn(),
}))

vi.mock('@/lib/api/search-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/search-service')>()
  return {
    ...actual,
    searchService: {
      searchPeople: hoisted.searchPeople,
      searchCompanies: hoisted.searchCompanies,
    },
  }
})

vi.mock('@/lib/api/saved-search-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/saved-search-service')>()
  return {
    ...actual,
    savedSearchService: {
      list: hoisted.savedList,
      create: hoisted.savedCreate,
      rename: hoisted.savedRename,
      remove: hoisted.savedRemove,
    },
  }
})

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({
    isAuthenticated: true,
    status: 'authenticated',
    user: { email: 'a@b.dz', locale: 'en', tier: 'free', credits_balance: 15, email_verified_at: null },
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

const RESULT: SearchResult<{ id: string; name: string }> = {
  results: [],
  total: 42,
  page: 1,
  truncated: false,
  refine_prompt: null,
}

function savedRow(overrides: Partial<SavedSearchRow> = {}): SavedSearchRow {
  return {
    id: 'saved-1',
    name: 'Importers Oran',
    type: 'people',
    filters: { industry: [2], wilaya: [31], keyword: 'textile' },
    sort: { field: 'role', dir: 'desc' },
    created_at: '2026-08-06T00:00:00Z',
    updated_at: '2026-08-06T00:00:00Z',
    ...overrides,
  }
}

function renderPage(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  )
}

beforeEach(() => {
  hoisted.searchPeople.mockReset()
  hoisted.searchCompanies.mockReset()
  hoisted.savedList.mockReset()
  hoisted.savedCreate.mockReset()
  hoisted.savedRename.mockReset()
  hoisted.savedRemove.mockReset()
  hoisted.savedList.mockResolvedValue([])
  hoisted.savedCreate.mockResolvedValue(savedRow())
  hoisted.savedRename.mockResolvedValue(savedRow())
  hoisted.savedRemove.mockResolvedValue(undefined)
})

describe('SearchPage saved searches', () => {
  it('saves the active search with the exact payload and sort', async () => {
    hoisted.searchPeople.mockResolvedValue(RESULT)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.count')

    fireEvent.click(screen.getByText('search.saved.save'))
    const input = await screen.findByLabelText('search.saved.name_label')
    fireEvent.change(input, { target: { value: 'My saved' } })
    fireEvent.click(screen.getByText('common.actions.save'))

    await vi.waitFor(() => expect(hoisted.savedCreate).toHaveBeenCalledTimes(1))
    const payload = hoisted.savedCreate.mock.calls[0][0]
    expect(payload.name).toBe('My saved')
    expect(payload.type).toBe('people')
    expect(payload.filters).toEqual(
      buildFiltersPayload(
        { industries: [], wilayas: [], seniorities: [], sizes: [], includeUnknownSize: false, keyword: '' },
        'people',
      ),
    )
    expect(payload.sort).toBeNull()
  })

  it('disables save when no search has run yet', () => {
    renderPage(<SearchPage tab="people" />)
    const save = screen.getByText('search.saved.save')
    expect(save.closest('button')).toBeDisabled()
    fireEvent.click(save)
    expect(hoisted.savedCreate).not.toHaveBeenCalled()
  })

  it('re-runs a saved search with one query restoring filters, wilayas and sort', async () => {
    hoisted.savedList.mockResolvedValue([savedRow()])
    const calls: string[][] = []
    hoisted.searchPeople.mockImplementation(async (...args: unknown[]) => {
      calls.push(args.map(String))
      return RESULT
    })
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(await screen.findByText('Importers Oran'))

    expect(calls).toHaveLength(1)
    const expectedJson = JSON.stringify(
      buildFiltersPayload(
        { industries: [2], wilayas: [31], seniorities: [], sizes: [], includeUnknownSize: false, keyword: 'textile' },
        'people',
      ),
    )
    expect(calls[0][0]).toBe(expectedJson)
    expect(calls[0][1]).toBe('1')
    expect(calls[0][2]).toBe('role:desc')

    await screen.findByText('search.results.count')

    const aside = screen.getByTestId('filter-sidebar')
    const chips = within(aside).getByTestId('wilaya-chips')
    expect(chips.textContent).toContain('31')
    expect(aside.textContent).toContain('Oran')

    const roleHeader = screen.getByRole('columnheader', { name: 'search.results.columns.role' })
    expect(roleHeader).toHaveAttribute('aria-sort', 'descending')

    expect(screen.getByText('Importers Oran').closest('li')).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('does not double-count the restored wilaya in the sidebar badge', async () => {
    hoisted.savedList.mockResolvedValue([savedRow()])
    hoisted.searchPeople.mockResolvedValue(RESULT)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(await screen.findByText('Importers Oran'))
    await screen.findByText('search.results.count')

    await vi.waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
    expect(screen.queryByText('4')).not.toBeInTheDocument()
  })

  it('shows only saved searches matching the current tab', async () => {
    hoisted.savedList.mockResolvedValue([
      savedRow({ id: 'p', type: 'people', name: 'people saved' }),
      savedRow({ id: 'c', type: 'company', name: 'company saved' }),
    ])
    hoisted.searchCompanies.mockResolvedValue(RESULT)
    renderPage(<SearchPage tab="companies" />)

    expect(await screen.findByText('company saved')).toBeInTheDocument()
    expect(screen.queryByText('people saved')).not.toBeInTheDocument()
  })
})
