import { render, screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FilterSidebar, removeFacetValue } from '@/components/search/FilterSidebar'
import { EMPTY_FILTERS, type StagedFilters } from '@/lib/api/search-service'
import type { ReactNode } from 'react'

const upgradeOpenMock = vi.hoisted(() => vi.fn())
const planMock = vi.hoisted(() => vi.fn(() => Promise.resolve({
  tier: 'free', status: null, renews_on: null,
  balances: { subscription_balance: 0, pack_balance: 0, display_balance: 15 },
})))
vi.mock('@/lib/api/billing-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/billing-service')>()
  return { ...actual, billingService: { ...actual.billingService, plan: planMock } }
})

vi.mock('@/components/providers/UpgradeDialogProvider', () => ({
  useUpgradeDialog: () => ({
    open: upgradeOpenMock,
    close: vi.fn(),
    isOpen: false,
  }),
}))

const sessionUser = vi.hoisted(() => ({
  value: null as null | { email: string; locale: string; tier: string },
}))
vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({ user: sessionUser.value }),
}))

const EMPTY: StagedFilters = { ...EMPTY_FILTERS }

// The FilterSidebar now hosts a data island (the 5.7 daily-limit dialog
// trigger reads the plan query) — every render + rerender must sit inside
// the QueryClientProvider (a raw rerender drops the wrapper).
function wrap(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{element}</QueryClientProvider>
}

function renderSidebar(overrides: Partial<Parameters<typeof FilterSidebar>[0]> = {}) {
  const props = {
    tab: 'people' as const,
    onSubmit: vi.fn(),
    ...overrides,
  }
  const view = render(wrap(<FilterSidebar {...props} />))
  return { ...view, props }
}

beforeEach(() => {
  upgradeOpenMock.mockReset()
  sessionUser.value = null
})

function groupOf(key: string): HTMLElement {
  const match = screen
    .getAllByText(key)
    .map((el) => el.closest('[data-testid="filter-group"]'))
    .find((el): el is HTMLElement => el !== null)
  if (!match) throw new Error(`No filter-group found for heading ${key}`)
  return match
}

function assertHeadingOrder(keys: string[]): void {
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = groupOf(keys[i])
    const b = groupOf(keys[i + 1])
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
}

describe('FilterSidebar desktop', () => {
  it('renders a persistent sidebar at the sidebar-width token with card fill and inline-end border', () => {
    renderSidebar()

    const aside = screen.getByTestId('filter-sidebar')
    expect(aside).toHaveClass('w-sidebar-width')
    expect(aside).toHaveClass('bg-card')
    expect(aside).toHaveClass('border-inline-end')
    expect(aside).toHaveClass('border-border')
  })

  it('renders the groups in order: industry, wilaya, seniority, keyword (people)', () => {
    renderSidebar({ tab: 'people' })

    assertHeadingOrder([
      'search.filters.industry',
      'search.filters.wilaya',
      'search.filters.seniority',
      'search.filters.keyword',
    ])
  })

  it('renders the groups in order: industry, wilaya, size, keyword (companies)', () => {
    renderSidebar({ tab: 'companies' })

    assertHeadingOrder([
      'search.filters.industry',
      'search.filters.wilaya',
      'search.filters.size',
      'search.filters.keyword',
    ])
    expect(screen.queryAllByText('search.filters.seniority')).toHaveLength(0)
    expect(screen.queryAllByText('search.filters.include_unknown_size')).not.toHaveLength(0)
  })

  it('gates the size group to the companies tab and hides it on people', () => {
    renderSidebar({ tab: 'people' })

    expect(screen.queryAllByText('search.filters.size')).toHaveLength(0)
    expect(screen.queryAllByText('search.filters.include_unknown_size')).toHaveLength(0)
  })

  it('lists all 35 industries with localized names', () => {
    renderSidebar()

    const industryGroup = groupOf('search.filters.industry')
    expect(within(industryGroup).getAllByRole('checkbox')).toHaveLength(35)
    expect(within(industryGroup).getByRole('checkbox', { name: 'Construction' })).toBeInTheDocument()
  })

  it('renders a custom wilaya field in place of the placeholder', () => {
    renderSidebar({ wilayaField: <div data-testid="custom-wilaya" /> })

    expect(screen.getByTestId('custom-wilaya')).toBeInTheDocument()
    expect(screen.queryByTestId('wilaya-placeholder')).not.toBeInTheDocument()
  })

  it('keeps active wilayas in the badge after Clear All (wilayaCount is a live active-filter count)', () => {
    renderSidebar({ wilayaCount: 3 })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.clear' }))

    const trigger = screen.getByRole('button', { name: /search\.filters\.title/ })
    expect(within(trigger).getByText('3')).toBeInTheDocument()
  })

  it('normalizes the badge so wilayas are counted once when the draft mirrors applied', () => {
    const applied: StagedFilters = { ...EMPTY, wilayas: [31, 16] }
    renderSidebar({ applied, wilayaCount: 2 })

    const trigger = screen.getByRole('button', { name: /search\.filters\.title/ })
    expect(within(trigger).getByText('2')).toBeInTheDocument()
    expect(within(trigger).queryByText('4')).toBeNull()
  })

  it('applies a chip removal to the draft with remove semantics', () => {
    const { rerender, props } = renderSidebar({ applied: { ...EMPTY, industries: [1, 4] } })
    const remove: Parameters<typeof FilterSidebar>[0]['chipRemove'] = {
      facet: 'industries',
      value: 1,
    }
    rerender(wrap(<FilterSidebar {...props} chipRemove={remove} />))

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ industries: [4] }))
  })

  it('preserves sidebar edits made after a chip removal (no replace clobber)', () => {
    const { rerender, props } = renderSidebar({ applied: { ...EMPTY, industries: [1] } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Advertising' }))
    const remove: Parameters<typeof FilterSidebar>[0]['chipRemove'] = {
      facet: 'industries',
      value: 1,
    }
    rerender(wrap(<FilterSidebar {...props} chipRemove={remove} />))

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ industries: [4] }))
  })

  it('applies sequential chip removals of the same facet cumulatively', () => {
    const { rerender, props } = renderSidebar({ applied: { ...EMPTY, industries: [1, 4, 9] } })
    const removeOne: Parameters<typeof FilterSidebar>[0]['chipRemove'] = {
      facet: 'industries',
      value: 1,
    }
    rerender(wrap(<FilterSidebar {...props} chipRemove={removeOne} />))
    const removeTwo: Parameters<typeof FilterSidebar>[0]['chipRemove'] = {
      facet: 'industries',
      value: 4,
    }
    rerender(wrap(<FilterSidebar {...props} chipRemove={removeTwo} />))

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ industries: [9] }))
  })

  it('resets the draft when the clear nonce bumps', () => {
    const { rerender, props } = renderSidebar({ applied: { ...EMPTY, industries: [1] } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    rerender(wrap(<FilterSidebar {...props} clearNonce={1} />))

    const trigger = screen.getByRole('button', { name: /search\.filters\.title/ })
    expect(within(trigger).queryByText('1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ industries: [] }))
  })

  it('notifies the page when the sidebar Clear All is used (wilaya clear wiring)', () => {
    const onClearAllRequest = vi.fn()
    renderSidebar({ wilayaCount: 3, onClearAllRequest })

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.clear' }))
    expect(onClearAllRequest).toHaveBeenCalledTimes(1)
  })

  it('stages edits without firing the query', () => {
    const { props } = renderSidebar({ tab: 'companies' })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'search.size.1_10' }))
    fireEvent.change(screen.getByLabelText('search.filters.keyword'), {
      target: { value: 'oran' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'search.filters.include_unknown_size' }))

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('fires exactly one onSubmit per Apply click with the full staged draft', () => {
    const { props } = renderSidebar({ tab: 'companies' })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'search.size.1_10' }))
    fireEvent.change(screen.getByLabelText('search.filters.keyword'), {
      target: { value: 'oran' },
    })

    const apply = screen.getByRole('button', { name: 'search.filters.apply' })
    fireEvent.click(apply)

    expect(props.onSubmit).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).toHaveBeenCalledWith({
      industries: [1],
      wilayas: [],
      seniorities: [],
      sizes: ['1-10'],
      includeUnknownSize: false,
      keyword: 'oran',
    })
  })

  it('marks Apply aria-disabled while busy and ignores clicks', () => {
    const { props } = renderSidebar({ busy: true })

    const apply = screen.getByRole('button', { name: 'common.states.loading' })
    expect(apply).toHaveAttribute('aria-disabled', 'true')
    expect(apply).toBeEnabled()

    fireEvent.click(apply)
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('marks Apply aria-disabled when rate-limited and shows the message inline', () => {
    const { props } = renderSidebar({
      rateLimited: true,
      rateLimitMessage: 'server.limit.message',
    })

    const apply = screen.getByRole('button', { name: 'search.filters.apply' })
    expect(apply).toHaveAttribute('aria-disabled', 'true')
    const message = screen.getByText('server.limit.message')
    expect(apply.getAttribute('aria-describedby')).toBe(message.id)

    fireEvent.click(apply)
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('opens the Upgrade Dialog when a FREE user clicks the rate-limited Apply (daily-limit entry)', () => {
    // 5.7 (John V7 amendment 4): the search 429 is the AC's "daily-limit
    // state" — disabled-but-actionable: a free user's click opens the
    // dialog (the search quota is tier-keyed: 30 free / 100 starter).
    sessionUser.value = { email: 'a@b.dz', locale: 'en', tier: 'free' }
    const { props } = renderSidebar({ rateLimited: true })
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(upgradeOpenMock).toHaveBeenCalledTimes(1)
  })

  it('never opens the dialog for a rate-limited STARTER user (nothing to upgrade into)', () => {
    sessionUser.value = { email: 'a@b.dz', locale: 'en', tier: 'starter' }
    const { props } = renderSidebar({ rateLimited: true })
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.apply' }))
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(upgradeOpenMock).not.toHaveBeenCalled()
  })

  it('falls back to the generic rate-limit key when no message is provided', () => {
    renderSidebar({ rateLimited: true })

    expect(screen.getByText('search.results.rate_limited')).toBeInTheDocument()
  })

  it('clears the whole draft via Clear All without firing the query', () => {
    const { props } = renderSidebar({ tab: 'companies' })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'search.size.1_10' }))
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.clear' }))

    const industryGroup = groupOf('search.filters.industry')
    expect(
      within(industryGroup)
        .getAllByRole('checkbox')
        .every((box) => box.getAttribute('aria-checked') === 'false'),
    ).toBe(true)
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('clears only the affected group via the per-group Clear affordance', () => {
    renderSidebar({ tab: 'companies' })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'search.size.1_10' }))
    for (const label of [
      'search.size.11_50',
      'search.size.51_200',
      'search.size.201_500',
      'search.size.500_plus',
    ]) {
      fireEvent.click(screen.getByRole('checkbox', { name: label }))
    }

    const sizeGroup = groupOf('search.filters.size')
    fireEvent.click(within(sizeGroup).getByRole('button', { name: 'search.filters.clear_group' }))

    const industryGroup = groupOf('search.filters.industry')
    expect(within(industryGroup).getByRole('checkbox', { name: 'Construction' })).toBeChecked()
    expect(
      within(sizeGroup)
        .getAllByRole('checkbox')
        .every((box) => box.getAttribute('aria-checked') === 'true'),
    ).toBe(false)
  })

  it('selects every industry via Select all', () => {
    renderSidebar()

    const industryGroup = groupOf('search.filters.industry')
    fireEvent.click(within(industryGroup).getByRole('button', { name: 'search.filters.select_all' }))

    expect(
      within(industryGroup)
        .getAllByRole('checkbox')
        .every((box) => box.getAttribute('aria-checked') === 'true'),
    ).toBe(true)
  })
})

describe('FilterSidebar mobile trigger and badge', () => {
  it('renders a mobile-only trigger with the Filters badge counting staged + active filters', () => {
    renderSidebar({ tab: 'companies', wilayaCount: 3 })

    const trigger = screen.getByRole('button', { name: /search\.filters\.title/ })
    expect(trigger).toHaveClass('md:hidden')
    expect(within(trigger).getByText('3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Construction' }))
    fireEvent.change(screen.getByLabelText('search.filters.keyword'), {
      target: { value: 'oran' },
    })

    expect(within(trigger).getByText('5')).toBeInTheDocument()
  })

  it('announces badge count changes through an sr-only status region outside the trigger', () => {
    renderSidebar()

    const status = screen.getByRole('status')
    expect(status).toHaveClass('sr-only')
    expect(status).toHaveTextContent('search.filters.badge')
    expect(status.closest('button')).toBeNull()
  })

  it('uses rounded-md on the Apply button', () => {
    renderSidebar()

    expect(screen.getByRole('button', { name: 'search.filters.apply' })).toHaveClass('rounded-md')
  })

  it('gives the drawer close button a 44px touch target on mobile', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    await screen.findByRole('dialog', { name: 'search.filters.title' })

    expect(screen.getByRole('button', { name: 'common.actions.close' })).toHaveClass('size-11')
  })

  it('uses distinct ids for the aside and drawer group controls', async () => {
    renderSidebar()

    const asideInput = screen.getByLabelText('search.filters.keyword')
    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    const dialog = await screen.findByRole('dialog', { name: 'search.filters.title' })
    const drawerInput = within(dialog).getByLabelText('search.filters.keyword')

    expect(asideInput.id).not.toBe(drawerInput.id)
    expect(asideInput.id).not.toBe('')
  })
})

describe('FilterSidebar mobile drawer', () => {
  it('opens a bottom sheet labelled by the filters title with a visible close button', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))

    const dialog = await screen.findByRole('dialog', { name: 'search.filters.title' })
    expect(within(dialog).getByRole('button', { name: 'common.actions.close' })).toBeInTheDocument()
    expect(within(dialog).getAllByTestId('filter-group').length).toBeGreaterThan(0)
  })

  it('gives initial focus to the close button on open', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))

    const dialog = await screen.findByRole('dialog', { name: 'search.filters.title' })
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'common.actions.close' })).toHaveFocus()
    })
  })

  it('closes via the close button and returns focus to the trigger', async () => {
    renderSidebar()
    const trigger = screen.getByRole('button', { name: /search\.filters\.title/ })

    fireEvent.click(trigger)
    await screen.findByRole('dialog', { name: 'search.filters.title' })
    fireEvent.click(screen.getByRole('button', { name: 'common.actions.close' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(trigger)
    })
  })

  it('closes via the Esc key and returns focus to the trigger', async () => {
    renderSidebar()
    const trigger = screen.getByRole('button', { name: /search\.filters\.title/ })

    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'search.filters.title' })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(trigger)
    })
  })

  it('closes via scrim tap', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    await screen.findByRole('dialog', { name: 'search.filters.title' })

    const overlay = document.querySelector('[data-slot="drawer-overlay"]')
    expect(overlay).not.toBeNull()
    fireEvent.click(overlay as Element)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes via swipe-down past the threshold', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    const dialog = await screen.findByRole('dialog', { name: 'search.filters.title' })

    fireEvent.pointerDown(dialog, { pointerId: 1, clientX: 200, clientY: 80, buttons: 1 })
    fireEvent.pointerMove(dialog, { pointerId: 1, clientX: 200, clientY: 160, buttons: 1 })
    fireEvent.pointerMove(dialog, { pointerId: 1, clientX: 200, clientY: 320, buttons: 1 })
    fireEvent.pointerUp(dialog, { pointerId: 1, clientX: 200, clientY: 320, buttons: 1 })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('applies from the sheet: exactly one submit and the sheet closes', async () => {
    const { props } = renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    const dialog = await screen.findByRole('dialog', { name: 'search.filters.title' })

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Construction' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'search.filters.apply' }))

    expect(props.onSubmit).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('renders the swipe handle for the sheet', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    await screen.findByRole('dialog', { name: 'search.filters.title' })

    expect(document.querySelector('[data-slot="drawer-swipe-handle"]')).not.toBeNull()
  })

  it('offers Clear All inside the drawer and forwards it to the page', async () => {
    const onClearAllRequest = vi.fn()
    renderSidebar({ wilayaCount: 2, onClearAllRequest })

    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    const dialog = await screen.findByRole('dialog', { name: 'search.filters.title' })

    fireEvent.click(within(dialog).getByRole('button', { name: 'search.filters.clear' }))
    expect(onClearAllRequest).toHaveBeenCalledTimes(1)
  })
})

describe('FilterSidebar saved-searches slot', () => {
  it('renders the slot inside the desktop aside below the filter groups', () => {
    renderSidebar({ savedSearchesSlot: <div data-testid="saved-slot" /> })
    const aside = screen.getByTestId('filter-sidebar')
    const slot = screen.getByTestId('saved-slot')
    const lastGroup = screen.getAllByTestId('filter-group').at(-1)
    expect(lastGroup).toBeDefined()
    expect(
      (lastGroup as HTMLElement).compareDocumentPosition(slot) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(aside.contains(slot)).toBe(true)
  })

  it('renders the slot inside the mobile drawer below the groups', async () => {
    renderSidebar({ savedSearchesSlot: <div data-testid="saved-slot" /> })
    fireEvent.click(screen.getByRole('button', { name: /search\.filters\.title/ }))
    const drawer = await screen.findByRole('dialog', { name: 'search.filters.title' })
    const slot = within(drawer).getByTestId('saved-slot')
    const groups = within(drawer).getAllByTestId('filter-group')
    const lastGroup = groups.at(-1)
    expect(lastGroup).toBeDefined()
    expect(
      (lastGroup as HTMLElement).compareDocumentPosition(slot) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders nothing when the slot is unwired (backward compatible)', () => {
    renderSidebar()
    expect(screen.queryByTestId('saved-slot')).not.toBeInTheDocument()
  })
})

describe('removeFacetValue', () => {
  it('removes a value from each array facet', () => {
    const base: StagedFilters = { ...EMPTY, industries: [1, 4], wilayas: [31], seniorities: ['director'], sizes: ['1-10'] }
    expect(removeFacetValue(base, 'industries', 1).industries).toEqual([4])
    expect(removeFacetValue(base, 'wilayas', 31).wilayas).toEqual([])
    expect(removeFacetValue(base, 'seniorities', 'director').seniorities).toEqual([])
    expect(removeFacetValue(base, 'sizes', '1-10').sizes).toEqual([])
  })

  it('clears the keyword and the unknown-size toggle', () => {
    const base: StagedFilters = { ...EMPTY, keyword: 'oran', includeUnknownSize: true }
    expect(removeFacetValue(base, 'keyword', 'oran').keyword).toBe('')
    expect(removeFacetValue(base, 'includeUnknownSize', true).includeUnknownSize).toBe(false)
  })
})

describe('FilterSidebar RTL', () => {
  it('keeps the group order and uses no physical layout classes inside an RTL container', () => {
    const { container } = render(
      wrap(
        <div dir="rtl">
          <FilterSidebar tab="people" onSubmit={vi.fn()} />
        </div>,
      ),
    )

    assertHeadingOrder([
      'search.filters.industry',
      'search.filters.wilaya',
      'search.filters.seniority',
      'search.filters.keyword',
    ])

    const sidebar = screen.getByTestId('filter-sidebar')
    const forbidden = ['left-', 'right-', 'ml-', 'mr-', 'pl-', 'pr-', 'text-left', 'text-right']
    for (const cls of forbidden) {
      expect(sidebar.className).not.toContain(cls)
    }
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull()
  })
})
