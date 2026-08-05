import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ResultsTableStackedRow } from '@/components/search/ResultsTableStackedRow'
import type { CompanyResultRow, PeopleResultRow } from '@/lib/api/search-service'

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
  },
]

describe('ResultsTableStackedRow', () => {
  it('renders one card per record in result order', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    expect(screen.getAllByTestId('stacked-card')).toHaveLength(2)
    const cards = screen.getAllByTestId('stacked-card')
    expect(within(cards[0]).getByText('Amina Benali')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Karim')).toBeInTheDocument()
  })

  it('uses card fill, 1px border, rounded-lg and gutter padding', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    for (const card of screen.getAllByTestId('stacked-card')) {
      expect(card).toHaveClass('bg-card')
      expect(card).toHaveClass('border')
      expect(card).toHaveClass('border-border')
      expect(card).toHaveClass('rounded-lg')
      expect(card).toHaveClass('p-gutter')
    }
  })

  it('renders the lead name in title weight with muted small meta', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('Amina Benali')).toHaveClass('text-title')
    expect(within(first).getByText('Gérante')).toHaveClass('text-small')
    expect(within(first).getByText('Gérante')).toHaveClass('text-muted-foreground')
  })

  it('shows people meta as role and company', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('Gérante')).toBeInTheDocument()
    expect(within(first).getByText('SARL X')).toBeInTheDocument()
  })

  it('shows company meta as industry and size', () => {
    render(<ResultsTableStackedRow tab="companies" rows={COMPANY_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('Construction')).toBeInTheDocument()
    expect(within(first).getByText('search.size.500_plus')).toBeInTheDocument()
  })

  it('renders the wilaya line with tabular-nums code', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    expect(within(first).getByText('31')).toHaveClass('tabular-nums')
    expect(
      screen.getAllByText((_, element) => element?.textContent === '31 — Oran').length,
    ).toBeGreaterThan(0)
  })

  it('renders the company name as a real link in both tabs', () => {
    const { rerender } = render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
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

  it('renders a full-width reveal action slot at the bottom of each card', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const first = screen.getAllByTestId('stacked-card')[0]
    const slot = within(first).getByTestId('reveal-slot')
    expect(slot).toHaveClass('w-full')
    expect(slot).toHaveClass('min-h-11')
    expect(slot).toHaveTextContent('common.actions.reveal')
  })

  it('renders null cells as muted em-dashes', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const second = screen.getAllByTestId('stacked-card')[1]
    expect(within(second).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('wraps Arabic-script fragments in lang="ar" dir="rtl"', () => {
    render(
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
          },
        ]}
      />,
    )
    const name = screen.getByText('الجزائر')
    expect(name).toHaveAttribute('lang', 'ar')
    expect(name).toHaveAttribute('dir', 'rtl')
  })

  it('keeps the same record order as the table (reflow, not redesign)', () => {
    render(<ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />)
    const names = screen
      .getAllByTestId('stacked-card')
      .map((card) => within(card).getByText(/Amina|Karim/).textContent)
    expect(names).toEqual(['Amina Benali', 'Karim'])
  })

  it('uses no physical-property classes in the card markup', () => {
    const { container } = render(
      <ResultsTableStackedRow tab="people" rows={PEOPLE_ROWS} />,
    )
    const html = container.innerHTML
    expect(html).not.toMatch(/(^|\s)(left|right)-\S/)
    expect(html).not.toMatch(/(^|\s)(ml|mr|pl|pr)-\S/)
    expect(html).not.toMatch(/text-(left|right)(\s|")/)
  })
})
