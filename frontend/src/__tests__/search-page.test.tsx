import { render, screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
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

const RESULT: SearchResult = {
  results: [],
  total: 42,
  page: 1,
  truncated: false,
  refine_prompt: null,
}

function deferredResult(data: SearchResult = RESULT) {
  let resolve!: (value: SearchResult) => void
  const promise = new Promise<SearchResult>((r) => {
    resolve = r
  })
  const call = vi.fn(() => promise)
  return { call, resolve: () => resolve(data) }
}

beforeEach(() => {
  hoisted.searchPeople.mockReset()
  hoisted.searchCompanies.mockReset()
})

describe('SearchPage', () => {
  it('renders tab links, the sidebar, the skip link and the pre-search empty state', () => {
    render(<SearchPage tab="people" />)

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
    render(<SearchPage tab="people" />)

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
    expect(call).toHaveBeenCalledWith(expectedPayload)

    resolve()
    await screen.findByText('search.results.count')
    expect(screen.queryByText('common.states.loading')).not.toBeInTheDocument()
  })

  it('shows the truncated notice when the API reports truncation', async () => {
    const { call, resolve } = deferredResult({ ...RESULT, truncated: true })
    hoisted.searchPeople.mockImplementation(call)
    render(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    resolve()
    await screen.findByText('search.results.count')

    expect(screen.getByText('search.results.truncated')).toBeInTheDocument()
  })

  it('shows the empty-results prompt for a zero-match search', async () => {
    hoisted.searchPeople.mockResolvedValue({ ...RESULT, total: 0 })
    render(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findByText('search.results.empty')

    expect(screen.queryByText('search.results.count')).not.toBeInTheDocument()
  })

  it('enters the rate-limited state on 429: message shown and Apply aria-disabled', async () => {
    hoisted.searchPeople.mockRejectedValue({
      response: { status: 429, data: { detail: 'server.limit.message', code: 'search_limit_exceeded' } },
    })
    render(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))

    await screen.findAllByText('server.limit.message')
    const apply = screen.getByRole('button', { name: 'search.filters.apply' })
    expect(apply).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows the error state with a working Retry for other failures', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockRejectedValueOnce({ response: { status: 500 } })
    hoisted.searchPeople.mockImplementationOnce(call)
    render(<SearchPage tab="people" />)

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
    render(<SearchPage tab="companies" />)

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
    expect(call).toHaveBeenCalledWith(expectedPayload)

    resolve()
    await screen.findByText('search.results.count')
    expect(hoisted.searchPeople).not.toHaveBeenCalled()
  })

  it('keeps staged filters editable while a query is in flight', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    render(<SearchPage tab="people" />)

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
    render(<SearchPage tab="people" />)

    const status = screen.getByRole('status')
    expect(status).toHaveClass('sr-only')
    expect(status).toHaveTextContent('search.filters.badge')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('fires exactly one query for a double-click on Apply', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    render(<SearchPage tab="people" />)

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
    render(<SearchPage tab="people" />)

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
    render(<SearchPage tab="people" />)

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    await screen.findAllByText('server.limit.message')

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(screen.getAllByText('server.limit.message').length).toBe(2)
    expect(hoisted.searchPeople).toHaveBeenCalledTimes(1)
  })

  it('merges wilaya combobox selections into the people query payload', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchPeople.mockImplementation(call)
    render(<SearchPage tab="people" />)

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
    expect(call).toHaveBeenCalledWith(expectedPayload)

    resolve()
    await screen.findByText('search.results.count')
  })

  it('merges multiple wilaya selections into the companies query payload', async () => {
    const { call, resolve } = deferredResult()
    hoisted.searchCompanies.mockImplementation(call)
    render(<SearchPage tab="companies" />)

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
    expect(call).toHaveBeenCalledWith(expectedPayload)

    resolve()
    await screen.findByText('search.results.count')
  })

  it('feeds the sidebar badge with the live wilaya selection count', async () => {
    hoisted.searchPeople.mockResolvedValue(RESULT)
    render(<SearchPage tab="people" />)

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
})
