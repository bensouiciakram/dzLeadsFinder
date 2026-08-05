import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchPage } from '@/components/search/SearchPage'
import { buildFiltersPayload, type SearchResult } from '@/lib/api/search-service'

const hoisted = vi.hoisted(() => ({
  searchPeople: vi.fn(),
  searchCompanies: vi.fn(),
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

const RESULT: SearchResult<{ id: string; name: string }> = {
  results: [],
  total: 42,
  page: 1,
  truncated: false,
  refine_prompt: null,
}

function deferredResult(data: SearchResult<{ id: string; name: string }> = RESULT) {
  let resolve!: (value: SearchResult<{ id: string; name: string }>) => void
  const promise = new Promise<SearchResult<{ id: string; name: string }>>((r) => {
    resolve = r
  })
  const call = vi.fn(() => promise)
  return { call, resolve: () => resolve(data) }
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
})

describe('SearchPage', () => {
  it('renders tab links, the sidebar, the skip link and the pre-search empty state', () => {
    renderPage(<SearchPage tab="people" />)

    const peopleTab = screen.getByRole('link', { name: 'search.people_tab' })
    const companiesTab = screen.getByRole('link', { name: 'search.companies_tab' })
    expect(peopleTab).toHaveAttribute('href', '/search')
    expect(peopleTab).toHaveAttribute('aria-current', 'page')
    expect(companiesTab).toHaveAttribute('href', '/search/companies')
    expect(companiesTab).not.toHaveAttribute('aria-current')

    expect(screen.getByTestId('filter-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('checklist-slot')).toBeInTheDocument()
    expect(screen.getByText('search.results.not_run')).toBeInTheDocument()
    expect(screen.getByText('search.skip_to_results')).toHaveAttribute('href', '#results')
    expect(screen.queryByText('search.results.count')).not.toBeInTheDocument()
  })

  it('fires exactly one people query on Apply and shows the count', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    expect(
      within(screen.getByTestId('filter-sidebar')).getByRole('button', {
        name: 'common.states.loading',
      }),
    ).toHaveAttribute('aria-disabled', 'true')
    expect(call).toHaveBeenCalledTimes(1)
    const expectedPayload = JSON.stringify(
      buildFiltersPayload(
        { industries: [1], wilayas: [], seniorities: [], sizes: [], includeUnknownSize: false, keyword: '' },
        'people',
      ),
    )
    expect(call).toHaveBeenCalledWith(expectedPayload, 1, 'name:asc', expect.any(AbortSignal))

    resolve()
    await screen.findByText('search.results.count')
    expect(screen.queryByText('common.states.loading')).not.toBeInTheDocument()
  })

  it('shows the truncated notice when the API reports truncation', async () => {
    const { call, resolve } = deferredResult({ ...RESULT, truncated: true })
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    expect(screen.getByText('search.results.truncated')).toBeInTheDocument()
  })

  it('shows the empty-results prompt for a zero-match search', async () => {
    hoisted.searchPeople.mockResolvedValue({ ...RESULT, total: 0 })
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.empty')

    expect(screen.queryByText('search.results.count')).not.toBeInTheDocument()
  })

  it('enters the rate-limited state on 429: message shown and Apply aria-disabled', async () => {
    hoisted.searchPeople.mockRejectedValue({
      response: { status: 429, data: { detail: 'server.limit.message', code: 'search_limit_exceeded' } },
    })
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    await screen.findAllByText('server.limit.message')
    const apply = screen.getByRole('button', { name: 'search.filters.apply' })
    expect(apply).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows the error state with a working Retry for other failures', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockRejectedValueOnce({ response: { status: 500 } })
    hoisted.searchPeople.mockImplementationOnce(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('common.states.error')

    fireEvent.click(screen.getByRole('button', { name: 'search.results.retry' }))
    expect(call).toHaveBeenCalledTimes(1)

    resolve()
    await screen.findByText('search.results.count')
  })

  it('queries the companies endpoint on the companies tab', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchCompanies.mockImplementation(call)
    renderPage(<SearchPage tab="companies" />)

    expect(screen.getByRole('link', { name: 'search.companies_tab' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(call).toHaveBeenCalledTimes(1)

    const expectedPayload = JSON.stringify(
      buildFiltersPayload(
        { industries: [], wilayas: [], seniorities: [], sizes: [], includeUnknownSize: false, keyword: '' },
        'companies',
      ),
    )
    expect(call).toHaveBeenCalledWith(expectedPayload, 1, 'name:asc', expect.any(AbortSignal))

    resolve()
    await screen.findByText('search.results.count')
    expect(hoisted.searchPeople).not.toHaveBeenCalled()
  })

  it('keeps staged filters editable while a query is in flight', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Advertising' }))
    expect(
      within(screen.getByTestId('filter-sidebar')).getByRole('checkbox', { name: 'Advertising' }),
    ).toBeChecked()

    resolve()
    await screen.findByText('search.results.count')

    expect(
      within(screen.getByTestId('filter-sidebar')).getByRole('checkbox', { name: 'Advertising' }),
    ).toBeChecked()
  })

  it('renders the sr-only live region for badge announcements', () => {
    renderPage(<SearchPage tab="people" />)

    const status = screen.getByRole('status')
    expect(status).toHaveClass('sr-only')
    expect(status).toHaveTextContent('search.filters.badge')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('fires exactly one query for a double-click on Apply', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    const apply = screen.getByRole('button', { name: 'search.filters.apply' })
    fireEvent.click(apply)
    fireEvent.click(apply)

    expect(call).toHaveBeenCalledTimes(1)

    resolve()
    await screen.findByText('search.results.count')
  })

  it('never renders stale results next to the error state', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    hoisted.searchPeople.mockRejectedValueOnce({ response: { status: 500 } })
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    await screen.findByText('common.states.error')
    expect(screen.queryByText('search.results.count')).not.toBeInTheDocument()
    expect(screen.queryByText('search.results.truncated')).not.toBeInTheDocument()
  })

  it('keeps the rate-limited state until a new query is possible (staged for tomorrow)', async () => {
    hoisted.searchPeople.mockRejectedValue({
      response: { status: 429, data: { detail: 'server.limit.message' } },
    })
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findAllByText('server.limit.message')

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(screen.getAllByText('server.limit.message').length).toBe(2)
    expect(hoisted.searchPeople).toHaveBeenCalledTimes(1)
  })

  it('merges wilaya combobox selections into the people query payload', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    const input = screen.getByRole('combobox')
    fireEvent.mouseDown(input)
    fireEvent.mouseUp(input)
    fireEvent.click(input)
    input.focus()
    fireEvent.click(await screen.findByRole('option', { name: '31 — Oran' }))
    fireEvent.keyDown(input, { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    expect(call).toHaveBeenCalledTimes(1)
    const expectedPayload = JSON.stringify(
      buildFiltersPayload(
        { industries: [], wilayas: [31], seniorities: [], sizes: [], includeUnknownSize: false, keyword: '' },
        'people',
      ),
    )
    expect(call).toHaveBeenCalledWith(expectedPayload, 1, 'name:asc', expect.any(AbortSignal))

    resolve()
    await screen.findByText('search.results.count')
  })

  it('merges multiple wilaya selections into the companies query payload', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchCompanies.mockImplementation(call)
    renderPage(<SearchPage tab="companies" />)

    const input = screen.getByRole('combobox')
    fireEvent.mouseDown(input)
    fireEvent.mouseUp(input)
    fireEvent.click(input)
    input.focus()
    fireEvent.click(await screen.findByRole('option', { name: '31 — Oran' }))
    fireEvent.click(await screen.findByRole('option', { name: '16 — Algiers' }))
    fireEvent.keyDown(input, { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    const expectedPayload = JSON.stringify(
      buildFiltersPayload(
        { industries: [], wilayas: [31, 16], seniorities: [], sizes: [], includeUnknownSize: false, keyword: '' },
        'companies',
      ),
    )
    expect(call).toHaveBeenCalledWith(expectedPayload, 1, 'name:asc', expect.any(AbortSignal))

    resolve()
    await screen.findByText('search.results.count')
  })

  it('feeds the sidebar badge with the live wilaya selection count', async () => {
    hoisted.searchPeople.mockResolvedValue(RESULT)
    renderPage(<SearchPage tab="people" />)

    const input = screen.getByRole('combobox')
    fireEvent.mouseDown(input)
    fireEvent.mouseUp(input)
    fireEvent.click(input)
    input.focus()
    fireEvent.click(await screen.findByRole('option', { name: '31 — Oran' }))
    fireEvent.click(await screen.findByRole('option', { name: '16 — Algiers' }))
    fireEvent.keyDown(input, { key: 'Escape' })

    const trigger = screen.getByRole('button', { name: /search\.filters\.title/ })
    expect(within(trigger).getByText('2')).toBeInTheDocument()
  })

  it('renders skeleton rows while a query is in flight and clears them on success', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    expect(screen.getByTestId('results-area')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0)

    resolve()
    await screen.findByText('search.results.count')
    expect(screen.queryByTestId('skeleton-row')).toBeNull()
    expect(screen.getByTestId('results-area')).toHaveAttribute('aria-busy', 'false')
  })

  it('moves the polite live region to the count/status line, not the whole section', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    expect(screen.getByTestId('results')).not.toHaveAttribute('aria-live')
    expect(screen.getByTestId('results-status')).toHaveAttribute('aria-live', 'polite')
  })

  it('shows pagination controls only above 100 results and navigates pages', async () => {
    const { call, resolve } = deferredResult({
      results: [{ id: '1', name: 'A' }],
      total: 105,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    const previous = screen.getByRole('button', { name: 'search.results.previous' })
    const next = screen.getByRole('button', { name: 'common.actions.next' })
    expect(previous).toBeDisabled()
    expect(next).not.toBeDisabled()
    const indicator = screen.getByText('search.results.pagination')
    expect(indicator).toHaveAttribute('aria-current', 'page')

    fireEvent.click(next)
    expect(call).toHaveBeenLastCalledWith(
      expect.any(String),
      2,
      'name:asc',
      expect.any(AbortSignal),
    )
    const found = await screen.findAllByText('search.results.pagination')
    expect(found.length).toBeGreaterThanOrEqual(2)
  })

  it('hides pagination controls at or below 100 results', async () => {
    hoisted.searchPeople.mockResolvedValue({ ...RESULT, total: 100 })
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.count')

    expect(screen.queryByRole('button', { name: 'search.results.previous' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'common.actions.next' })).toBeNull()
  })

  it('re-runs the query with the sort param on a header click and announces it', async () => {
    const { call, resolve } = deferredResult({
      results: [{ id: '1', name: 'A' }],
      total: 3,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')
    expect(call).toHaveBeenLastCalledWith(expect.any(String), 1, 'name:asc', expect.any(AbortSignal))

    fireEvent.click(screen.getByRole('button', { name: 'search.sort.name' }))
    expect(call).toHaveBeenLastCalledWith(expect.any(String), 1, 'name:asc', expect.any(AbortSignal))
    expect(await screen.findByText('search.results.sort_asc')).toBeInTheDocument()
  })

  it('announces page changes through the status live region', async () => {
    const { call, resolve } = deferredResult({
      results: [{ id: '1', name: 'A' }],
      total: 250,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    fireEvent.click(screen.getByRole('button', { name: 'common.actions.next' }))
    const status = screen.getByTestId('results-status')
    expect(await within(status).findByText('search.results.pagination')).toBeInTheDocument()
  })

  it('offers broaden suggestion + Clear all filters on empty results and resets without a query', async () => {
    hoisted.searchPeople.mockResolvedValue({ ...RESULT, total: 0 })
    renderPage(<SearchPage tab="people" />)

    const input = screen.getByRole('combobox')
    fireEvent.mouseDown(input)
    fireEvent.mouseUp(input)
    fireEvent.click(input)
    input.focus()
    fireEvent.click(await screen.findByRole('option', { name: '31 — Oran' }))
    fireEvent.keyDown(input, { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.empty')

    const clearAll = screen.getByRole('button', { name: 'search.results.clear_all' })
    fireEvent.click(clearAll)

    expect(hoisted.searchPeople).toHaveBeenCalledTimes(1)
    expect(screen.getByText('search.results.not_run')).toBeInTheDocument()
    expect(screen.queryByText('31 — Oran')).toBeNull()
    const badgeTrigger = screen.getByRole('button', { name: /search\.filters\.title/ })
    expect(within(badgeTrigger).queryByText('1')).toBeNull()
  })

  it('clears the combobox when the sidebar Clear All is used', async () => {
    const { call, resolve } = deferredResult({
      results: [{ id: '1', name: 'A' }],
      total: 3,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    const input = screen.getByRole('combobox')
    fireEvent.mouseDown(input)
    fireEvent.mouseUp(input)
    fireEvent.click(input)
    input.focus()
    fireEvent.click(await screen.findByRole('option', { name: '31 — Oran' }))
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.clear' }))

    expect(screen.getByText('search.results.not_run')).toBeInTheDocument()
    expect(screen.queryByText('31 — Oran')).toBeNull()
    const badgeTrigger = screen.getByRole('button', { name: /search\.filters\.title/ })
    expect(within(badgeTrigger).queryByText('1')).toBeNull()
  })

  it('shares one combobox query between the aside and drawer instances', async () => {
    hoisted.searchPeople.mockResolvedValue(RESULT)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    await screen.findByRole('dialog')

    const inputs = Array.from(document.querySelectorAll('input[role="combobox"]'))
    expect(inputs.length).toBe(2)

    fireEvent.change(inputs[0], { target: { value: 'oran' } })
    expect(inputs[0]).toHaveValue('oran')
    expect(inputs[1]).toHaveValue('oran')
  })

  it('renders chips for applied filters and stages removals through Apply', async () => {
    const { call, resolve } = deferredResult({
      results: [{ id: '1', name: 'A' }],
      total: 3,
      page: 1,
      truncated: false,
      refine_prompt: null,
    })
    hoisted.searchPeople.mockImplementation(call)
    renderPage(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    const chipArea = screen.getByTestId('active-filter-chips')
    const chip = within(chipArea).getByText('Construction')
    const removeButton = chipArea.querySelector('button')
    expect(removeButton).not.toBeNull()
    fireEvent.click(removeButton!)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    const expectedPayload = JSON.stringify(
      buildFiltersPayload(
        { industries: [], wilayas: [], seniorities: [], sizes: [], includeUnknownSize: false, keyword: '' },
        'people',
      ),
    )
    expect(call).toHaveBeenLastCalledWith(expectedPayload, 1, 'name:asc', expect.any(AbortSignal))
  })
})
