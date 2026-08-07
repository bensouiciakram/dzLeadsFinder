import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchPage } from '@/components/search/SearchPage'
import { checklistService, type ChecklistState } from '@/lib/api/checklist-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'
import type { SearchResult } from '@/lib/api/search-service'
import { CreditProvider } from '@/components/providers/CreditProvider'
import { creditsService } from '@/lib/api/credits-service'

const hoisted = vi.hoisted(() => ({
  searchPeople: vi.fn(),
  searchCompanies: vi.fn(),
  checklistGet: vi.fn(),
  checklistDismiss: vi.fn(),
  creditsGetBanner: vi.fn(),
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

vi.mock('@/lib/api/checklist-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/checklist-service')>()
  return {
    ...actual,
    checklistService: {
      get: hoisted.checklistGet,
      dismiss: hoisted.checklistDismiss,
    },
  }
})

vi.mock('@/lib/api/credits-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/credits-service')>()
  return {
    ...actual,
    creditsService: {
      ledger: vi.fn(),
      getBanner: hoisted.creditsGetBanner,
      dismissBanner: vi.fn(),
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

const FRESH: ChecklistState = {
  step_search: false,
  step_reveal: false,
  step_export: false,
  dismissed: false,
}

function renderPage(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreditProvider>{element}</CreditProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  hoisted.searchPeople.mockReset()
  hoisted.searchCompanies.mockReset()
  hoisted.checklistGet.mockReset()
  hoisted.checklistDismiss.mockReset()
  hoisted.creditsGetBanner.mockReset()
  hoisted.checklistGet.mockResolvedValue(FRESH)
  hoisted.searchPeople.mockResolvedValue(RESULT)
  hoisted.creditsGetBanner.mockResolvedValue({ dismissed: false })
})

describe('SearchPage checklist card placement', () => {
  it('renders the card BEFORE any search (slot relocation regression)', async () => {
    renderPage(<SearchPage tab="people" />)
    expect(await screen.findByTestId('checklist-card')).toBeInTheDocument()
    expect(screen.getByText('search.results.not_run')).toBeInTheDocument()
  })

  it('keeps the card visible AFTER the first search (the critical AC)', async () => {
    renderPage(<SearchPage tab="people" />)
    await screen.findByTestId('checklist-card')
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.count')
    expect(screen.getByTestId('checklist-card')).toBeInTheDocument()
  })

  it('renders the 15-credit banner ABOVE the card as the first children of the results section', async () => {
    renderPage(<SearchPage tab="people" />)
    await screen.findByTestId('checklist-card')
    await screen.findByTestId('credits-banner')
    const results = screen.getByTestId('results')
    const firstChild = results.firstElementChild
    const secondChild = firstChild?.nextElementSibling
    expect(firstChild?.getAttribute('data-testid')).toBe('credits-banner')
    expect(secondChild?.getAttribute('data-testid')).toBe('checklist-card')
  })
})

describe('SearchPage checklist live check-off', () => {
  it('completes step 1 after a successful search and announces via the results-status region', async () => {
    hoisted.checklistGet
      .mockResolvedValueOnce(FRESH)
      .mockResolvedValueOnce({ ...FRESH, step_search: true })
    renderPage(<SearchPage tab="people" />)
    await screen.findByTestId('checklist-card')
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.count')

    await waitFor(() => expect(hoisted.checklistGet).toHaveBeenCalledTimes(2))

    const searchRow = screen
      .getByText('search.checklist.step_search')
      .closest('li')
    expect(searchRow?.querySelector('svg')?.getAttribute('class')).toContain('text-success')

    const status = screen.getByTestId('results-status')
    expect(within(status).getByRole('status').textContent).toBe(
      'search.checklist.done_search',
    )
  })

  it('does not announce for a returning user whose step is already done', async () => {
    hoisted.checklistGet.mockResolvedValue({ ...FRESH, step_search: true })
    renderPage(<SearchPage tab="people" />)
    await screen.findByTestId('checklist-card')
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.count')
    await new Promise((resolve) => setTimeout(resolve, 50))
    const status = screen.getByTestId('results-status')
    expect(within(status).queryByRole('status')).not.toBeInTheDocument()
  })

  it('still announces step 1 when the mount checklist fetch failed', async () => {
    hoisted.checklistGet
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ...FRESH, step_search: true })
    renderPage(<SearchPage tab="people" />)
    await screen.findByText('search.results.not_run')
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.count')

    await waitFor(() => expect(hoisted.checklistGet).toHaveBeenCalledTimes(2))

    const status = screen.getByTestId('results-status')
    await waitFor(() =>
      expect(within(status).getByRole('status').textContent).toBe(
        'search.checklist.done_search',
      ),
    )
  })
})

describe('SearchPage checklist dismissal', () => {
  it('unmounts the card after dismiss from the page', async () => {
    hoisted.checklistGet
      .mockResolvedValueOnce(FRESH)
      .mockResolvedValueOnce({ ...FRESH, dismissed: true })
    hoisted.checklistDismiss.mockResolvedValue({ ...FRESH, dismissed: true })
    renderPage(<SearchPage tab="people" />)
    fireEvent.click(await screen.findByLabelText('search.checklist.dismiss'))
    await waitFor(() => expect(hoisted.checklistDismiss).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument(),
    )
  })

  it('never renders the card for a user who dismissed it earlier', async () => {
    hoisted.checklistGet.mockResolvedValue({ ...FRESH, dismissed: true })
    renderPage(<SearchPage tab="people" />)
    await waitFor(() => expect(hoisted.checklistGet).toHaveBeenCalled())
    expect(screen.queryByTestId('checklist-card')).not.toBeInTheDocument()
  })
})
