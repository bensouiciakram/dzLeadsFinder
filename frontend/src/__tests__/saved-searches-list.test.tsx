import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SavedSearchesList } from '@/components/search/SavedSearchesList'
import { savedSearchService } from '@/lib/api/saved-search-service'
import type { SavedSearchRow } from '@/lib/api/saved-search-service'

type SessionShape = {
  isAuthenticated: boolean
  status: 'loading' | 'authenticated' | 'guest'
  user: {
    email: string
    locale: string
    tier: string
    credits_balance: number
    email_verified_at: string | null
  } | null
  refresh: () => void
  logout: () => void
}

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn<() => SessionShape>(() => ({
    isAuthenticated: false,
    status: 'guest',
    user: null,
    refresh: vi.fn(),
    logout: vi.fn(),
  })),
}))

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: useSessionMock,
}))

vi.mock('@/lib/api/saved-search-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/saved-search-service')>()
  return {
    ...actual,
    savedSearchService: {
      list: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
    },
  }
})

const USER_FREE = {
  email: 'a@b.dz',
  locale: 'en',
  tier: 'free',
  credits_balance: 15,
  email_verified_at: null,
}

const USER_STARTER = { ...USER_FREE, tier: 'starter' }

function row(overrides: Partial<SavedSearchRow> = {}): SavedSearchRow {
  return {
    id: 'row-1',
    name: 'Importers Oran',
    type: 'people',
    filters: { industry: [2], wilaya: [31] },
    sort: null,
    created_at: '2026-08-06T00:00:00Z',
    updated_at: '2026-08-06T00:00:00Z',
    ...overrides,
  }
}

const ACTIVE = { type: 'people' as const, filters: { industry: [2] }, sort: null }

function renderList(overrides: { tier?: string; rows?: SavedSearchRow[] } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const { tier = 'free', rows = [] } = overrides
  useSessionMock.mockReturnValue({
    isAuthenticated: true,
    status: 'authenticated',
    user: tier === 'starter' ? USER_STARTER : USER_FREE,
    refresh: vi.fn(),
    logout: vi.fn(),
  })
  vi.mocked(savedSearchService.list).mockResolvedValue(rows)
  const onRerun = vi.fn()
  const utils = render(
    <QueryClientProvider client={client}>
      <SavedSearchesList
        tab="people"
        activeSearchId={null}
        activeSearch={ACTIVE}
        onRerun={onRerun}
      />
    </QueryClientProvider>,
  )
  return { onRerun, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SavedSearchesList', () => {
  it('renders the section title and a save affordance', async () => {
    renderList()
    expect(await screen.findByText('search.saved.title')).toBeInTheDocument()
    expect(screen.getByText('search.saved.save')).toBeInTheDocument()
  })

  it('renders the empty hint when nothing is saved', async () => {
    renderList({ rows: [] })
    expect(await screen.findByText('search.saved.empty')).toBeInTheDocument()
  })

  it('lists saved searches by raw name (never localized)', async () => {
    renderList({
      rows: [row({ name: 'فقط في الجزائر' }), row({ id: 'row-2', name: 'Oran importers' })],
    })
    expect(await screen.findByText('فقط في الجزائر')).toBeInTheDocument()
    expect(screen.getByText('Oran importers')).toBeInTheDocument()
  })

  it('re-runs on row click with the full row', async () => {
    const { onRerun } = renderList({ rows: [row()] })
    const nameButton = await screen.findByText('Importers Oran')
    fireEvent.click(nameButton)
    expect(onRerun).toHaveBeenCalledTimes(1)
    expect(onRerun).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-1', type: 'people' }))
  })

  it('filters the list to the current tab only', async () => {
    renderList({
      rows: [
        row({ id: 'p', type: 'people', name: 'people one' }),
        row({ id: 'c', type: 'company', name: 'company one' }),
      ],
    })
    expect(await screen.findByText('people one')).toBeInTheDocument()
    expect(screen.queryByText('company one')).not.toBeInTheDocument()
  })

  it('opens rename from the action menu without re-running', async () => {
    const { onRerun } = renderList({ rows: [row()] })
    await screen.findByText('Importers Oran')
    fireEvent.click(screen.getByLabelText('search.saved.actions'))
    fireEvent.click(await screen.findByText('search.saved.rename'))
    expect(await screen.findByText('search.saved.rename_title')).toBeInTheDocument()
    expect(onRerun).not.toHaveBeenCalled()
  })

  it('renames without firing a search', async () => {
    vi.mocked(savedSearchService.rename).mockResolvedValue(row({ name: 'Renamed' }))
    renderList({ rows: [row()] })
    await screen.findByText('Importers Oran')
    fireEvent.click(screen.getByLabelText('search.saved.actions'))
    fireEvent.click(await screen.findByText('search.saved.rename'))
    const input = await screen.findByLabelText('search.saved.name_label')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByText('common.actions.save'))
    await waitFor(() =>
      expect(savedSearchService.rename).toHaveBeenCalledWith('row-1', 'Renamed'),
    )
  })

  it('deletes via the confirm dialog', async () => {
    vi.mocked(savedSearchService.remove).mockResolvedValue(undefined)
    renderList({ rows: [row()] })
    await screen.findByText('Importers Oran')
    fireEvent.click(screen.getByLabelText('search.saved.actions'))
    fireEvent.click(await screen.findByText('common.actions.delete'))
    expect(await screen.findByText('search.saved.delete_confirm')).toBeInTheDocument()
    fireEvent.click(screen.getByText('common.actions.delete'))
    await waitFor(() => expect(savedSearchService.remove).toHaveBeenCalledWith('row-1'))
  })

  it('cancelling the delete confirm does nothing', async () => {
    renderList({ rows: [row()] })
    await screen.findByText('Importers Oran')
    fireEvent.click(screen.getByLabelText('search.saved.actions'))
    fireEvent.click(await screen.findByText('common.actions.delete'))
    fireEvent.click(await screen.findByText('common.actions.cancel'))
    expect(savedSearchService.remove).not.toHaveBeenCalled()
  })

  it('disables save at the free cap with a tooltip (aria-disabled, focusable)', async () => {
    const user = userEvent.setup()
    const rows = Array.from({ length: 5 }, (_, index) =>
      row({ id: `row-${index}`, name: `saved ${index}` }),
    )
    renderList({ rows })
    await screen.findByText('saved 4')
    const save = screen.getByText('search.saved.save')
    expect(save.closest('button')).toHaveAttribute('aria-disabled', 'true')
    await user.hover(save)
    expect(await screen.findByText('search.saved.cap_tooltip_free')).toBeInTheDocument()
  })

  it('enables save below the free cap', async () => {
    renderList({ rows: [row()] })
    await screen.findByText('Importers Oran')
    const save = screen.getByText('search.saved.save')
    expect(save.closest('button')).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('uses the starter cap of 25', async () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row({ id: `row-${index}`, name: `saved ${index}` }),
    )
    renderList({ tier: 'starter', rows })
    await screen.findByText('saved 24')
    await waitFor(() =>
      expect(screen.getByText('search.saved.save').closest('button')).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
  })

  it('disables save when there is no active search (no tooltip)', async () => {
    const client = new QueryClient()
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: USER_FREE,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(savedSearchService.list).mockResolvedValue([])
    render(
      <QueryClientProvider client={client}>
        <SavedSearchesList
          tab="people"
          activeSearchId={null}
          activeSearch={null}
          onRerun={vi.fn()}
        />
      </QueryClientProvider>,
    )
    const save = await screen.findByText('search.saved.save')
    expect(save.closest('button')).toBeDisabled()
  })

  it('marks the active search with aria-current', async () => {
    const client = new QueryClient()
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: USER_FREE,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(savedSearchService.list).mockResolvedValue([row()])
    render(
      <QueryClientProvider client={client}>
        <SavedSearchesList
          tab="people"
          activeSearchId="row-1"
          activeSearch={ACTIVE}
          onRerun={vi.fn()}
        />
      </QueryClientProvider>,
    )
    const item = (await screen.findByText('Importers Oran')).closest('li')
    expect(item).toHaveAttribute('aria-current', 'true')
  })

  it('shows a loading state then the list', async () => {
    let resolve: (rows: SavedSearchRow[]) => void = () => {}
    vi.mocked(savedSearchService.list).mockImplementation(
      () => new Promise((res) => (resolve = res)),
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    useSessionMock.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: USER_FREE,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    render(
      <QueryClientProvider client={client}>
        <SavedSearchesList
          tab="people"
          activeSearchId={null}
          activeSearch={ACTIVE}
          onRerun={vi.fn()}
        />
      </QueryClientProvider>,
    )
    expect(screen.getByText('common.states.loading')).toBeInTheDocument()
    resolve([row()])
    expect(await screen.findByText('Importers Oran')).toBeInTheDocument()
  })

  it('shows an inline error with retry', async () => {
    vi.mocked(savedSearchService.list).mockRejectedValueOnce(new Error('boom'))
    renderList({ rows: [] })
    expect(await screen.findByText('common.states.error')).toBeInTheDocument()
    vi.mocked(savedSearchService.list).mockResolvedValue([row()])
    fireEvent.click(screen.getByText('search.results.retry'))
    expect(await screen.findByText('Importers Oran')).toBeInTheDocument()
  })

  it('renders no physical property classes (RTL smoke)', async () => {
    const { container } = renderList({ rows: [row()] })
    await screen.findByText('Importers Oran')
    const ownClasses = container.querySelector('[data-testid="saved-searches"]')?.className ?? ''
    for (const physical of ['left-', 'right-', 'ml-', 'mr-', 'pl-', 'pr-', 'text-left', 'text-right']) {
      expect(ownClasses).not.toContain(physical)
    }
  })

  it('keeps rows keyboard reachable as real buttons', async () => {
    const { onRerun } = renderList({ rows: [row()] })
    const nameButton = await screen.findByText('Importers Oran')
    expect(nameButton.tagName).toBe('BUTTON')
    fireEvent.click(nameButton)
    expect(onRerun).toHaveBeenCalledTimes(1)
  })
})
