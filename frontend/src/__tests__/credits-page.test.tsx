import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreditsPage } from '@/components/credits/CreditsPage'
import { creditsService, type LedgerResult, type LedgerRow } from '@/lib/api/credits-service'
import { downloadCreditsCsv } from '@/lib/credits/csv'

const hoisted = vi.hoisted(() => ({
  ledger: vi.fn(),
  session: {
    user: {
      email: 'a@b.dz',
      locale: 'en',
      tier: 'free',
      credits_balance: 15,
      email_verified_at: null,
    } as SessionUserShape,
    authenticated: vi.fn(),
  },
}))

type SessionUserShape = {
  email: string
  locale: string
  tier: string
  credits_balance: number
  email_verified_at: string | null
}

hoisted.session.authenticated.mockReturnValue({
  isAuthenticated: true,
  status: 'authenticated',
  user: hoisted.session.user,
  refresh: vi.fn(),
  logout: vi.fn(),
})

vi.mock('@/lib/api/credits-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/credits-service')>()
  return {
    ...actual,
    creditsService: {
      ledger: hoisted.ledger,
    },
  }
})

vi.mock('@/lib/credits/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/credits/csv')>()
  return {
    ...actual,
    downloadCreditsCsv: vi.fn(),
  }
})

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => hoisted.session.authenticated(),
}))

function row(id: string, eventType: string, amount: number, balanceAfter: number): LedgerRow {
  return {
    id,
    event_type: eventType,
    amount,
    balance_after: balanceAfter,
    reference_id: 'ref-' + id,
    created_at: '2026-08-07T12:00:00+01:00',
  }
}

function pageOf(ids: string[], total: number, page: number): LedgerResult {
  return {
    results: ids.map((id, index) => row(id, index === 0 ? 'reveal_debit' : 'subscription_grant', -1, 200 - index)),
    total,
    page,
    truncated: false,
  }
}

const PAGE1: LedgerResult = pageOf(Array.from({ length: 50 }, (_, i) => `r${i + 1}`), 55, 1)
const PAGE2: LedgerResult = pageOf(['r51', 'r52', 'r53', 'r54', 'r55'], 55, 2)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreditsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  hoisted.ledger.mockReset()
  vi.mocked(downloadCreditsCsv).mockClear()
  hoisted.session.authenticated.mockReturnValue({
    isAuthenticated: true,
    status: 'authenticated',
    user: hoisted.session.user,
    refresh: vi.fn(),
    logout: vi.fn(),
  })
})

describe('CreditsPage guest state', () => {
  it('shows a sign-in prompt without fetching for guests', () => {
    hoisted.session.authenticated.mockReturnValue({
      isAuthenticated: false,
      status: 'guest',
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('common.credits.guest')).toBeInTheDocument()
    expect(hoisted.ledger).not.toHaveBeenCalled()
  })
})

describe('CreditsPage ledger states', () => {
  it('shows the loading state while fetching', () => {
    hoisted.ledger.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByTestId('credits-loading')).toBeInTheDocument()
  })

  it('shows an inline error with retry', async () => {
    hoisted.ledger.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(PAGE1)
    renderPage()
    await screen.findByText('common.states.error')
    fireEvent.click(screen.getByText('search.results.retry'))
    await screen.findByTestId('ledger-table')
  })

  it('renders the five AC columns with localized types', async () => {
    hoisted.ledger.mockResolvedValue({
      ...PAGE1,
      results: [
        row('r1', 'free_signup', 15, 15),
        row('r2', 'subscription_grant', 200, 215),
        row('r3', 'reveal_debit', -1, 14),
      ],
      total: 3,
    })
    renderPage()
    const table = await screen.findByTestId('ledger-table')
    const headers = table.querySelectorAll('thead th')
    expect(Array.from(headers).map((th) => th.textContent)).toEqual([
      'common.credits.column_type',
      'common.credits.column_amount',
      'common.credits.column_date',
      'common.credits.column_balance_after',
      'common.credits.column_reference',
    ])
    expect(screen.getByText('common.credits.type_reveal_debit')).toBeInTheDocument()
    expect(screen.getByText('common.credits.type_subscription_grant')).toBeInTheDocument()
    expect(screen.getByText('common.credits.type_free_signup')).toBeInTheDocument()
  })

  it('renders signed amounts and balance-after with tabular-nums', async () => {
    hoisted.ledger.mockResolvedValue({
      ...PAGE1,
      results: [row('r1', 'free_signup', 15, 15), row('r2', 'subscription_grant', 200, 215), row('r3', 'reveal_debit', -1, 14)],
      total: 3,
    })
    renderPage()
    await screen.findByTestId('ledger-table')
    expect(screen.getByText('+200')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('+200').className).toContain('tabular-nums')
    expect(screen.getByText('215').className).toContain('tabular-nums')
  })
})

describe('CreditsPage pagination', () => {
  it('navigates pages and refetches with the new page', async () => {
    // Mount consumes the first resolved value; the page-2 click the second.
    hoisted.ledger.mockResolvedValueOnce(PAGE1).mockResolvedValueOnce(PAGE2)
    renderPage()
    await screen.findByTestId('ledger-table')
    fireEvent.click(screen.getByText('common.actions.next'))
    await waitFor(() => expect(hoisted.ledger).toHaveBeenLastCalledWith(2))
    await screen.findByText('ref-r51')
  })
})

describe('CreditsPage CSV export', () => {
  it('exports the FULL window (all pages) with a CSV download', async () => {
    // Mount consumes one value; the export loop consumes the next two.
    hoisted.ledger
      .mockResolvedValueOnce(PAGE1)
      .mockResolvedValueOnce(PAGE1)
      .mockResolvedValueOnce(PAGE2)
    renderPage()
    await screen.findByTestId('ledger-table')
    fireEvent.click(screen.getByText('common.credits.export'))
    await waitFor(() => expect(downloadCreditsCsv).toHaveBeenCalledTimes(1))
    const [content, filename] = vi.mocked(downloadCreditsCsv).mock.calls[0]
    expect(filename).toBe('credits-90-days.csv')
    expect(content).toContain('ref-r1')
    expect(content).toContain('ref-r55')
  })

  it('still offers CSV (headers only) in the empty state', async () => {
    hoisted.ledger.mockResolvedValue({ ...PAGE1, results: [], total: 0 })
    renderPage()
    await screen.findByText('common.credits.empty')
    fireEvent.click(screen.getByText('common.credits.export'))
    await waitFor(() => expect(downloadCreditsCsv).toHaveBeenCalledTimes(1))
    const [content] = vi.mocked(downloadCreditsCsv).mock.calls[0]
    expect(content).toBe(
      '\uFEFFcommon.credits.column_type,common.credits.column_amount,common.credits.column_date,common.credits.column_balance_after,common.credits.column_reference\r\n',
    )
  })
})

describe('CreditsPage empty state', () => {
  it('shows the empty note with a /search link and the CSV button', async () => {
    hoisted.ledger.mockResolvedValue({ ...PAGE1, results: [], total: 0 })
    renderPage()
    await screen.findByText('common.credits.empty')
    const link = screen.getByText('common.credits.empty_cta')
    expect(link.closest('a')).toHaveAttribute('href', '/search')
    expect(screen.getByText('common.credits.export')).toBeInTheDocument()
  })

  it('shows the out-of-range note with a way back when a page empties out', async () => {
    // A 90-day expiry while sitting on page 2: the page returns [] but
    // activity exists on page 1 — the empty-note copy would be a lie.
    hoisted.ledger
      .mockResolvedValueOnce(PAGE1)
      .mockResolvedValueOnce({ ...PAGE1, results: [], total: 55, page: 2 })
    renderPage()
    await screen.findByTestId('ledger-table')
    fireEvent.click(screen.getByText('common.actions.next'))
    await waitFor(() => expect(hoisted.ledger).toHaveBeenLastCalledWith(2))
    expect(await screen.findByText('common.credits.no_more_pages')).toBeInTheDocument()
    expect(screen.queryByText('common.credits.empty')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('common.credits.back_to_page_one'))
    await waitFor(() => expect(hoisted.ledger).toHaveBeenLastCalledWith(1))
  })

  it('resets the page to 1 when the signed-in user changes', async () => {
    hoisted.ledger
      .mockResolvedValueOnce(PAGE1)
      .mockResolvedValueOnce(PAGE2)
      .mockResolvedValue({ ...PAGE1, results: [], total: 0 })
    renderPage()
    await screen.findByTestId('ledger-table')
    fireEvent.click(screen.getByText('common.actions.next'))
    await waitFor(() => expect(hoisted.ledger).toHaveBeenLastCalledWith(2))

    // A second account signs in: the page state must not carry over.
    hoisted.session.user = {
      email: 'other@x.dz',
      locale: 'en',
      tier: 'free',
      credits_balance: 3,
      email_verified_at: null,
    }
    hoisted.session.authenticated.mockReturnValue({
      isAuthenticated: true,
      status: 'authenticated',
      user: hoisted.session.user,
      refresh: vi.fn(),
      logout: vi.fn(),
    })
    await waitFor(() => expect(hoisted.ledger).toHaveBeenLastCalledWith(1))
  })
})

describe('CreditsPage RTL smoke', () => {
  it('uses no physical-property classes', async () => {
    hoisted.ledger.mockResolvedValue(PAGE1)
    renderPage()
    const table = await screen.findByTestId('ledger-table')
    expect(table.className).not.toMatch(/\b(left|right|ml-|mr-|pl-|pr-|text-left|text-right)\b/)
    const container = screen.getByTestId('credits-page')
    expect(container.className).not.toMatch(/\b(left|right|ml-|mr-|pl-|pr-|text-left|text-right)\b/)
  })
})
