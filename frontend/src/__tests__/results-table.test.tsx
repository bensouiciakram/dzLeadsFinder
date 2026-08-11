import { render, screen, within } from '@testing-library/react'
import { fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

import {
  ResultsTable,
  bandLabelKey,
  isArabic,
  sortCycle,
  type SortState,
} from '@/components/search/ResultsTable'
import type { CompanyResultRow, PeopleResultRow } from '@/lib/api/search-service'
import { CreditProvider, useCredits } from '@/components/providers/CreditProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'
import type { RevealResult } from '@/lib/api/reveal-service'

const sessionMock = vi.hoisted(() => ({
  user: {
    email: 'a@b.dz',
    locale: 'en',
    tier: 'free',
    credits_balance: 15,
    email_verified_at: null,
  },
  refresh: vi.fn(),
}))

const planMock = vi.hoisted(() => vi.fn(() => Promise.resolve({
  tier: 'free', status: null, renews_on: null,
  balances: { subscription_balance: 0, pack_balance: 0, display_balance: 15 },
})))
vi.mock('@/lib/api/billing-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/billing-service')>()
  return { ...actual, billingService: { ...actual.billingService, plan: planMock } }
})

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({ user: sessionMock.user, refresh: sessionMock.refresh }),
}))

const revealMock = vi.hoisted(() => ({ reveal: vi.fn() }))

const upgradeOpenMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/providers/UpgradeDialogProvider', () => ({
  useUpgradeDialog: () => ({
    open: upgradeOpenMock,
    close: vi.fn(),
    isOpen: false,
  }),
}))

const recoveryOpenMock = vi.hoisted(() => vi.fn())
vi.mock('@/components/providers/RecoveryDialogProvider', () => ({
  useRecoveryDialog: () => ({
    open: recoveryOpenMock,
    close: vi.fn(),
    isOpen: false,
  }),
}))

vi.mock('@/lib/api/reveal-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/reveal-service')>()
  return {
    ...actual,
    revealService: { reveal: revealMock.reveal },
  }
})

const PEOPLE_ROWS: PeopleResultRow[] = [
  {
    id: '1',
    name: 'Amina Benali',
    role: 'Gérante',
    company_name: 'SARL X',
    company_id: '42',
    wilaya_code: 31,
    wilaya_name: 'Oran',
    revealed: false,
  },
  {
    id: '2',
    name: 'Karim',
    role: null,
    company_name: null,
    company_id: null,
    wilaya_code: null,
    wilaya_name: null,
    revealed: false,
  },
]

const COMPANY_ROWS: CompanyResultRow[] = [
  {
    id: '42',
    name: 'SARL X',
    industry: 'Construction',
    industry_id: 1,
    wilaya_code: 31,
    wilaya_name: 'Oran',
    size_band: '500+',
    people_count: 2,
    revealed: false,
  },
  {
    id: '7',
    name: 'Société Y',
    industry: null,
    industry_id: null,
    wilaya_code: 16,
    wilaya_name: 'الجزائر',
    size_band: null,
    people_count: 0,
    revealed: false,
  },
]

const REVEAL_RESULT: RevealResult = {
  contact: {
    record_type: 'people',
    record_id: '1',
    name: 'Amina Benali',
    role: 'Gérante',
    company_name: 'SARL X',
    email: 'amina@x.dz',
    phone: '0550 12 34 56',
    address: 'Alger Centre',
  },
  balances: {
    subscription_balance: 14,
    pack_balance: 0,
    display_balance: 14,
  },
}

let creditProbe: { balance: number | null } = { balance: null }

function CreditProbe() {
  creditProbe = useCredits()
  return null
}

function renderTable(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (content: ReactNode) => (
    <QueryClientProvider client={client}>
      <CreditProvider>
        <ToastProvider>
          <CreditProbe />
          {content}
        </ToastProvider>
      </CreditProvider>
    </QueryClientProvider>
  )
  const result = render(tree(ui))
  return {
    ...result,
    rerender: (next: ReactNode) => result.rerender(tree(next)),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionMock.user = {
    email: 'a@b.dz',
    locale: 'en',
    tier: 'free',
    credits_balance: 15,
    email_verified_at: null,
  }
})

function peopleTable(sort: SortState | null = null) {
  const onSortChange = vi.fn()
  renderTable(
    <ResultsTable tab="people" rows={PEOPLE_ROWS} sort={sort} onSortChange={onSortChange} />,
  )
  return { onSortChange }
}

describe('sortCycle', () => {
  it('cycles none -> asc -> desc -> none per column', () => {
    expect(sortCycle('name', null)).toEqual({ field: 'name', dir: 'asc' })
    expect(sortCycle('name', { field: 'name', dir: 'asc' })).toEqual({
      field: 'name',
      dir: 'desc',
    })
    expect(sortCycle('name', { field: 'name', dir: 'desc' })).toEqual({
      field: 'name',
      dir: null,
    })
  })

  it('starts a fresh asc cycle on a different column', () => {
    expect(sortCycle('role', { field: 'name', dir: 'desc' })).toEqual({
      field: 'role',
      dir: 'asc',
    })
  })
})

describe('bandLabelKey', () => {
  it('maps size bands to their i18n keys', () => {
    expect(bandLabelKey('1-10')).toBe('search.size.1_10')
    expect(bandLabelKey('11-50')).toBe('search.size.11_50')
    expect(bandLabelKey('500+')).toBe('search.size.500_plus')
  })

  it('returns null for unknown bands so raw values render instead of keys', () => {
    expect(bandLabelKey('1000+')).toBeNull()
  })
})

describe('isArabic', () => {
  it('detects pure Arabic-script fragments', () => {
    expect(isArabic('وهران')).toBe(true)
    expect(isArabic('Oran')).toBe(false)
  })

  it('does not wrap mixed Latin/Arabic strings as RTL', () => {
    expect(isArabic('الجزائر SARL')).toBe(false)
  })
})

describe('ResultsTable columns', () => {
  it('renders the People column set in DOM order', () => {
    peopleTable()
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual([
      'search.sort.name',
      'search.results.columns.role',
      'search.results.columns.company',
      'search.sort.wilaya',
      'common.actions.reveal',
    ])
  })

  it('renders the Company column set in DOM order', () => {
    renderTable(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers).toEqual([
      'search.sort.name',
      'search.filters.industry',
      'search.sort.wilaya',
      'search.filters.size',
      'search.results.columns.people_count',
    ])
  })

  it('marks every data header sortable except the reveal action column', () => {
    peopleTable()
    const buttons = screen
      .getAllByRole('button', { name: /^search\.(sort|results|filters)/ })
      .filter((button) => button.closest('th') !== null)
    expect(buttons.map((b) => b.textContent)).toEqual([
      'search.sort.name',
      'search.results.columns.role',
      'search.results.columns.company',
      'search.sort.wilaya',
    ])
    const revealTh = screen
      .getAllByRole('columnheader')
      .find((th) => th.textContent === 'common.actions.reveal')
    expect(revealTh?.querySelector('button')).toBeNull()
  })

  it('renders sortable headers in the Company table including industry', () => {
    renderTable(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const buttons = screen
      .getAllByRole('button', { name: /^search\.(sort|results|filters)/ })
      .filter((button) => button.closest('th') !== null)
    expect(buttons.map((b) => b.textContent)).toEqual([
      'search.sort.name',
      'search.filters.industry',
      'search.sort.wilaya',
      'search.filters.size',
      'search.results.columns.people_count',
    ])
  })

  it('styles the header row with small/600/muted-foreground tokens', () => {
    peopleTable()
    for (const th of screen.getAllByRole('columnheader')) {
      expect(th).toHaveClass('font-semibold')
      expect(th).toHaveClass('text-muted-foreground')
      const label = (th.querySelector('[data-slot="sort-label"]') ??
        th.querySelector('button')) as HTMLElement
      expect(label).toHaveClass('text-small')
    }
  })
})

describe('ResultsTable sort interactions', () => {
  it('cycles asc -> desc -> none on repeated clicks of one header', () => {
    const onSortChange = vi.fn()
    const { rerender } = renderTable(
      <ResultsTable tab="people" rows={PEOPLE_ROWS} sort={null} onSortChange={onSortChange} />,
    )
    const nameButton = () => screen.getByRole('button', { name: 'search.sort.name' })

    fireEvent.click(nameButton())
    expect(onSortChange).toHaveBeenLastCalledWith({ field: 'name', dir: 'asc' })

    rerender(
      <ResultsTable
        tab="people"
        rows={PEOPLE_ROWS}
        sort={{ field: 'name', dir: 'asc' }}
        onSortChange={onSortChange}
      />,
    )
    fireEvent.click(nameButton())
    expect(onSortChange).toHaveBeenLastCalledWith({ field: 'name', dir: 'desc' })

    rerender(
      <ResultsTable
        tab="people"
        rows={PEOPLE_ROWS}
        sort={{ field: 'name', dir: 'desc' }}
        onSortChange={onSortChange}
      />,
    )
    fireEvent.click(nameButton())
    expect(onSortChange).toHaveBeenLastCalledWith({ field: 'name', dir: null })
  })

  it('cycles another column starting from the current active column', () => {
    const { onSortChange } = peopleTable({ field: 'name', dir: 'desc' })
    fireEvent.click(screen.getByRole('button', { name: 'search.results.columns.role' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ field: 'role', dir: 'asc' })
  })

  it('carries aria-sort only on the active column', () => {
    peopleTable({ field: 'name', dir: 'asc' })
    const active = screen.getByRole('columnheader', { name: 'search.sort.name' })
    expect(active).toHaveAttribute('aria-sort', 'ascending')
    for (const th of screen.getAllByRole('columnheader')) {
      if (th === active) continue
      expect(th).not.toHaveAttribute('aria-sort')
    }
  })

  it('reports descending sort via aria-sort', () => {
    peopleTable({ field: 'role', dir: 'desc' })
    expect(
      screen.getByRole('columnheader', { name: 'search.results.columns.role' }),
    ).toHaveAttribute('aria-sort', 'descending')
  })

  it('shows the chevron in none/asc/desc states', () => {
    const { rerender } = renderTable(
      <ResultsTable tab="people" rows={PEOPLE_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const chevron = () => screen.getByTestId('sort-chevron-name')
    expect(chevron()).toHaveAttribute('data-state', 'none')
    expect(chevron()).toHaveClass('text-muted-foreground')

    rerender(
      <ResultsTable
        tab="people"
        rows={PEOPLE_ROWS}
        sort={{ field: 'name', dir: 'asc' }}
        onSortChange={vi.fn()}
      />,
    )
    expect(chevron()).toHaveAttribute('data-state', 'asc')

    rerender(
      <ResultsTable
        tab="people"
        rows={PEOPLE_ROWS}
        sort={{ field: 'name', dir: 'desc' }}
        onSortChange={vi.fn()}
      />,
    )
    expect(chevron()).toHaveAttribute('data-state', 'desc')
  })
})

describe('ResultsTable rows', () => {
  it('uses 48px rows with bottom borders and muted hover', () => {
    peopleTable()
    const bodyRows = screen.getAllByRole('row').filter((tr) => tr.querySelector('td'))
    expect(bodyRows.length).toBeGreaterThan(0)
    for (const tr of bodyRows) {
      expect(tr).toHaveClass('h-12')
      expect(tr).toHaveClass('border-b')
      expect(tr).toHaveClass('hover:bg-muted')
    }
  })

  it('renders the company name as a real link in the Company table', () => {
    renderTable(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const link = screen.getByRole('link', { name: 'SARL X' })
    expect(link).toHaveAttribute('href', '/companies/42')
  })

  it('renders the company cell as a real link in the People table', () => {
    peopleTable()
    const link = screen.getByRole('link', { name: 'SARL X' })
    expect(link).toHaveAttribute('href', '/companies/42')
  })

  it('renders an em-dash instead of a link for company-less people', () => {
    peopleTable()
    const row = screen.getByText('Karim').closest('tr') as HTMLElement
    expect(within(row).queryByRole('link')).toBeNull()
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('does not make the row itself clickable', () => {
    peopleTable()
    const row = screen.getByText('Amina Benali').closest('tr') as HTMLElement
    expect(row).not.toHaveAttribute('onclick')
    expect(row).not.toHaveClass('cursor-pointer')
  })

  it('renders wilaya cells as code + localized name with tabular-nums code', () => {
    peopleTable()
    const row = screen.getByText('Amina Benali').closest('tr') as HTMLElement
    expect(
      screen.getAllByText((_, element) => element?.textContent === '31 — Oran').length,
    ).toBeGreaterThan(0)
    expect(within(row).getByText('31')).toHaveClass('tabular-nums')
  })

  it('wraps Arabic-script wilaya names in lang="ar" dir="rtl"', () => {
    const { container } = renderTable(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const name = screen.getByText('الجزائر')
    expect(name).toHaveAttribute('lang', 'ar')
    expect(name).toHaveAttribute('dir', 'rtl')

    const oranRow = screen.getByText('SARL X').closest('tr') as HTMLElement
    const oranCell = Array.from(oranRow.querySelectorAll('td')).find((td) =>
      td.textContent?.includes('Oran'),
    )
    expect(oranCell).toBeDefined()
    expect(oranCell?.querySelector('[lang]')).toBeNull()
    expect(container.querySelectorAll('[lang="ar"]')).toHaveLength(1)
  })

  it('uses tabular-nums on the People count column', () => {
    renderTable(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const row = screen.getByText('SARL X').closest('tr') as HTMLElement
    expect(within(row).getByText('2')).toHaveClass('tabular-nums')
  })

  it('renders size bands through their i18n keys and nulls as em-dash', () => {
    renderTable(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    expect(screen.getByText('search.size.500_plus')).toBeInTheDocument()
    const row = screen.getByText('Société Y').closest('tr') as HTMLElement
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders a zero people count as Western 0', () => {
    renderTable(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const row = screen.getByText('Société Y').closest('tr') as HTMLElement
    expect(within(row).getByText('0')).toHaveClass('tabular-nums')
  })

  it('renders null role as an em-dash in the People table', () => {
    peopleTable()
    const row = screen.getByText('Karim').closest('tr') as HTMLElement
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders the reveal button per row with the credit affordance', () => {
    peopleTable()
    const buttons = screen.getAllByTestId('reveal-slot')
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button).toHaveTextContent('common.actions.reveal')
      expect(button).toHaveTextContent('search.reveal.cost')
      expect(button).not.toBeDisabled()
    }
  })

  it('renders an unknown size band as its raw value', () => {
    renderTable(
      <ResultsTable
        tab="companies"
        rows={[{ ...COMPANY_ROWS[0], size_band: '1000+' }]}
        sort={null}
        onSortChange={vi.fn()}
      />,
    )
    expect(screen.getByText('1000+')).toBeInTheDocument()
    expect(screen.queryByText('search.size.1000_plus')).toBeNull()
  })

  it('renders skeleton rows as aria-hidden placeholders', () => {
    renderTable(
      <ResultsTable tab="people" rows={[]} sort={null} onSortChange={vi.fn()} skeleton />,
    )
    for (const row of screen.getAllByTestId('skeleton-row')) {
      expect(row).toHaveAttribute('aria-hidden', 'true')
    }
  })
})

describe('ResultsTable reveal control', () => {
  it('renders the reveal button with primary tokens and aria wiring', () => {
    peopleTable()
    const button = screen.getAllByTestId('reveal-slot')[0]
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'reveal-content-1')
    expect(button).toHaveClass('bg-primary')
    expect(button).toHaveClass('text-primary-foreground')
    expect(button).toHaveClass('rounded-md')
    expect(button).toHaveClass('md:min-h-8')
    expect(button).toHaveClass('min-h-11')
    expect(button).toHaveClass('w-full')
  })

  it('shows a spinner with aria-busy and expands optimistically while pending', () => {
    revealMock.reveal.mockReturnValue(new Promise(() => {}))
    peopleTable()

    fireEvent.click(screen.getAllByTestId('reveal-slot')[0])

    const button = screen.getAllByTestId('reveal-slot')[0]
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button.querySelector('[data-testid="reveal-spinner"]')).not.toBeNull()
    expect(button.querySelector('.sr-only')).toHaveTextContent('common.actions.reveal')
    const region = document.getElementById('reveal-content-1')
    expect(region).not.toBeNull()
    expect(region).toHaveAttribute('role', 'region')
    expect(creditProbe.balance).toBe(14)
  })

  it('ignores a second click while any reveal is in flight', async () => {
    revealMock.reveal.mockReturnValue(new Promise(() => {}))
    peopleTable()

    const button = screen.getAllByTestId('reveal-slot')[0]
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(revealMock.reveal).toHaveBeenCalledTimes(1))
  })

  it('renders the contact fields inline and keeps the row expanded on success', async () => {
    revealMock.reveal.mockResolvedValue(REVEAL_RESULT)
    peopleTable()

    fireEvent.click(screen.getAllByTestId('reveal-slot')[0])

    await waitFor(() => expect(screen.getByText('amina@x.dz')).toBeInTheDocument())
    expect(screen.getByText('0550 12 34 56')).toBeInTheDocument()
    expect(screen.getByText('Alger Centre')).toBeInTheDocument()
    expect(screen.getByText('search.reveal.field_email')).toBeInTheDocument()
    expect(screen.getByText('search.reveal.field_phone')).toBeInTheDocument()
    expect(screen.getByText('search.reveal.field_address')).toBeInTheDocument()
    expect(document.getElementById('reveal-content-1')).not.toBeNull()
    expect(screen.getByText('search.reveal.already_revealed')).toBeInTheDocument()
    expect(screen.getAllByTestId('reveal-slot')).toHaveLength(1)
    await waitFor(() => expect(creditProbe.balance).toBe(14))
  })

  it('does NOT toast the credit change on success (the pill owns the announcement)', async () => {
    revealMock.reveal.mockResolvedValue(REVEAL_RESULT)
    peopleTable()

    fireEvent.click(screen.getAllByTestId('reveal-slot')[0])

    // The 4.3 dedupe contract (4-2 review finding P12): the pill owns the
    // aria-live announcement — the reveal surface must not also toast, or
    // screen readers hear the change twice.
    await waitFor(() => expect(creditProbe.balance).toBe(14))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('search.reveal.deducted')).not.toBeInTheDocument()
  })

  it('collapses, rolls the credit back and toasts the failure message on error', async () => {
    revealMock.reveal.mockRejectedValue(new Error('boom'))
    peopleTable()

    fireEvent.click(screen.getAllByTestId('reveal-slot')[0])

    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('search.reveal.failed')
    expect(document.getElementById('reveal-content-1')).toBeNull()
    const button = screen.getAllByTestId('reveal-slot')[0]
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).not.toHaveAttribute('aria-busy')
    await waitFor(() => expect(creditProbe.balance).toBe(15))
  })

  it('fail-fasts while offline: immediate failure toast, no POST, no debit', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    peopleTable()

    fireEvent.click(screen.getAllByTestId('reveal-slot')[0])

    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('search.reveal.failed')
    expect(revealMock.reveal).not.toHaveBeenCalled()
    expect(document.getElementById('reveal-content-1')).toBeNull()
    const button = screen.getAllByTestId('reveal-slot')[0]
    expect(button).not.toHaveAttribute('aria-busy')
    await waitFor(() => expect(creditProbe.balance).toBe(15))

    delete (navigator as { onLine?: boolean }).onLine
  })

  it('renders the already-revealed badge with auto-visible fields on the free path', async () => {
    revealMock.reveal.mockResolvedValue(REVEAL_RESULT)
    renderTable(
      <ResultsTable
        tab="people"
        rows={[{ ...PEOPLE_ROWS[0], revealed: true }, PEOPLE_ROWS[1]]}
        sort={null}
        onSortChange={vi.fn()}
      />,
    )

    const badge = screen.getByText('search.reveal.already_revealed')
    expect(badge).toHaveClass('bg-success-container')
    expect(badge).toHaveClass('text-success-on-container')
    expect(badge).toHaveClass('rounded-full')
    await waitFor(() => expect(screen.getByText('amina@x.dz')).toBeInTheDocument())
    expect(revealMock.reveal).toHaveBeenCalledWith('people', '1')
    expect(screen.getAllByTestId('reveal-slot')).toHaveLength(1)
  })

  it('renders the aria-disabled zero-credit button and dispatches the recovery by tier', async () => {
    sessionMock.user = { ...sessionMock.user, tier: 'free', credits_balance: 0 }
    peopleTable()

    const button = screen.getAllByTestId('reveal-slot')[0]
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    expect(button).toHaveClass('bg-muted')
    expect(button).toHaveClass('text-muted-strong')
    expect(button).toHaveClass('border')
    expect(button).toHaveClass('border-border')

    fireEvent.focus(button)
    expect(await screen.findByText('search.reveal.no_credits')).toBeInTheDocument()

    // 5.7 (John V1): the 0-credit click dispatches by tier — free → the
    // Upgrade Dialog (the AC's "0-credit recovery" entry).
    fireEvent.click(button)
    expect(upgradeOpenMock).toHaveBeenCalledTimes(1)
    expect(recoveryOpenMock).not.toHaveBeenCalled()
    expect(revealMock.reveal).not.toHaveBeenCalled()
  })

  it('routes a STARTER user at 0 credits to the RecoveryDialog top-up', async () => {
    sessionMock.user = { ...sessionMock.user, tier: 'starter', credits_balance: 0 }
    peopleTable()

    fireEvent.click(screen.getAllByTestId('reveal-slot')[0])
    expect(recoveryOpenMock).toHaveBeenCalledTimes(1)
    expect(upgradeOpenMock).not.toHaveBeenCalled()
    expect(revealMock.reveal).not.toHaveBeenCalled()
  })
})

describe('ResultsTable RTL', () => {
  it('keeps the underlying DOM column order stable in RTL (FR-2)', () => {
    const { container } = renderTable(
      <div dir="rtl">
        <ResultsTable tab="people" rows={PEOPLE_ROWS} sort={null} onSortChange={vi.fn()} />
      </div>,
    )
    const headers = Array.from(container.querySelectorAll('th')).map((th) => th.textContent)
    expect(headers).toEqual([
      'search.sort.name',
      'search.results.columns.role',
      'search.results.columns.company',
      'search.sort.wilaya',
      'common.actions.reveal',
    ])
  })

  it('uses no physical-property classes in the table markup', () => {
    const { container } = renderTable(
      <ResultsTable tab="people" rows={PEOPLE_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const html = container.innerHTML
    expect(html).not.toMatch(/(^|\s)(left|right)-\S/)
    expect(html).not.toMatch(/(^|\s)(ml|mr|pl|pr)-\S/)
    expect(html).not.toMatch(/text-(left|right)(\s|")/)
  })
})
