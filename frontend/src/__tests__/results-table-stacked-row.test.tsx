import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

import { ResultsTableStackedRow } from '@/components/search/ResultsTableStackedRow'
import type { CompanyResultRow, PeopleResultRow } from '@/lib/api/search-service'
import { CreditProvider } from '@/components/providers/CreditProvider'
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

vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({ user: sessionMock.user, refresh: sessionMock.refresh }),
}))

const revealMock = vi.hoisted(() => ({ reveal: vi.fn() }))

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
]

const PEOPLE_REVEAL: RevealResult = {
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

const COMPANY_REVEAL: RevealResult = {
  contact: {
    record_type: 'company',
    record_id: '42',
    name: 'SARL X',
    industry: 'Construction',
    website: 'https://sarlx.dz',
    wilaya_code: 31,
    size_band: '500+',
  },
  balances: {
    subscription_balance: 14,
    pack_balance: 0,
    display_balance: 14,
  },
}

function renderCards(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (content: ReactNode) => (
    <QueryClientProvider client={client}>
      <CreditProvider>
        <ToastProvider>{content}</ToastProvider>
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

describe('ResultsTableStackedRow', () => {
  it('renders one card per record in result order', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    expect(screen.getAllByTestId('stacked-card')).toHaveLength(2)
    const cards = screen.getAllByTestId('stacked-card')
    expect(within(cards[0]).getByText('Amina Benali')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Karim')).toBeInTheDocument()
  })

  it('uses card fill, 1px border, rounded-lg and gutter padding', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    for (const card of screen.getAllByTestId('stacked-card')) {
      expect(card).toHaveClass('bg-card')
      expect(card).toHaveClass('border')
      expect(card).toHaveClass('border-border')
      expect(card).toHaveClass('rounded-lg')
      expect(card).toHaveClass('p-gutter')
    }
  })

  it('renders the lead name in title weight with muted small meta', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('Amina Benali')).toHaveClass('text-title')
    expect(within(first).getByText('Gérante')).toHaveClass('text-small')
    expect(within(first).getByText('Gérante')).toHaveClass('text-muted-foreground')
  })

  it('shows people meta as role and company', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('Gérante')).toBeInTheDocument()
    expect(within(first).getByText('SARL X')).toBeInTheDocument()
  })

  it('shows company meta as industry and size', () => {
    renderCards(<ResultsTableStackedRow tab="companies" rows={COMPANY_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('Construction')).toBeInTheDocument()
    expect(within(first).getByText('search.size.500_plus')).toBeInTheDocument()
  })

  it('renders the wilaya line with tabular-nums code', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('31')).toHaveClass('tabular-nums')
    expect(
      screen.getAllByText((_, element) => element?.textContent === '31 — Oran').length,
    ).toBeGreaterThan(0)
  })

  it('renders the company name as a real link in both tabs', () => {
    const { rerender } = renderCards(
      <ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />,
    )
    expect(screen.getByRole('link', { name: 'SARL X' })).toHaveAttribute(
      'href',
      '/companies/42',
    )
    rerender(<ResultsTableStackedRow tab="companies" rows={COMPANY_ROWS} />)
    expect(screen.getByRole('link', { name: 'SARL X' })).toHaveAttribute(
      'href',
      '/companies/42',
    )
  })

  it('renders a full-width reveal action at the bottom of each card', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    const slot = within(first).getByTestId('reveal-slot')
    expect(slot).toHaveClass('w-full')
    expect(slot).toHaveClass('min-h-11')
    expect(slot).toHaveTextContent('common.actions.reveal')
    expect(slot).toHaveTextContent('search.reveal.cost')
    expect(slot).not.toBeDisabled()
  })

  it('renders an em-dash company line for company-less people (same data as the table)', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const second = screen.getAllByTestId('stacked-card')[1]
    expect(within(second).getAllByText('—').length).toBeGreaterThan(1)
  })

  it('renders the People count line on company cards with tabular numerals', () => {
    renderCards(<ResultsTableStackedRow tab="companies" rows={COMPANY_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText(/search\.results\.columns\.people_count/)).toBeInTheDocument()
    expect(within(first).getByText('2')).toHaveClass('tabular-nums')
  })

  it('renders null cells as muted em-dashes', () => {
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const second = screen.getAllByTestId('stacked-card')[1]
    expect(within(second).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('wraps Arabic-script fragments in lang="ar" dir="rtl"', () => {
    renderCards(
      <ResultsTableStackedRow
        tab="companies"
        rows={[
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
        ]}
      />,
    )
    const name = screen.getByText('الجزائر')
    expect(name).toHaveAttribute('lang', 'ar')
    expect(name).toHaveAttribute('dir', 'rtl')
  })

  it('uses no physical-property classes in the card markup', () => {
    const { container } = renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const html = container.innerHTML
    expect(html).not.toMatch(/(^|\s)(left|right)-\S/)
    expect(html).not.toMatch(/(^|\s)(ml|mr|pl|pr)-\S/)
    expect(html).not.toMatch(/text-(left|right)(\s|")/)
  })

  it('renders company contact fields with the website link on reveal', async () => {
    revealMock.reveal.mockResolvedValue(COMPANY_REVEAL)
    renderCards(<ResultsTableStackedRow tab="companies" rows={COMPANY_ROWS} />)

    fireEvent.click(screen.getAllByTestId('reveal-slot')[0])

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'https://sarlx.dz' })).toHaveAttribute(
        'href',
        'https://sarlx.dz',
      ),
    )
    expect(screen.getByText('search.reveal.field_website')).toBeInTheDocument()
    expect(screen.getByText('search.reveal.field_industry')).toBeInTheDocument()
    expect(screen.getByText('search.reveal.field_size_band')).toBeInTheDocument()
    expect(within(screen.getByTestId('reveal-fields')).getByText('search.size.500_plus'))
      .toBeInTheDocument()
  })

  it('expands people contact fields inline below the meta lines on success', async () => {
    revealMock.reveal.mockResolvedValue(PEOPLE_REVEAL)
    renderCards(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)

    const first = screen.getAllByTestId('stacked-card')[0]
    fireEvent.click(within(first).getByTestId('reveal-slot'))

    await waitFor(() => expect(within(first).getByText('amina@x.dz')).toBeInTheDocument())
    expect(within(first).getByText('0550 12 34 56')).toBeInTheDocument()
  })

  it('renders the already-revealed badge on a revealed company row without a click', async () => {
    revealMock.reveal.mockResolvedValue(COMPANY_REVEAL)
    renderCards(
      <ResultsTableStackedRow
        tab="companies"
        rows={[{ ...COMPANY_ROWS[0], revealed: true }]}
      />,
    )

    expect(screen.getByText('search.reveal.already_revealed')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('https://sarlx.dz')).toBeInTheDocument())
    expect(revealMock.reveal).toHaveBeenCalledWith('company', '42')
    expect(screen.queryByTestId('reveal-slot')).toBeNull()
  })
})
