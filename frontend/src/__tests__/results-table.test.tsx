import { render, screen, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  ResultsTable,
  bandLabelKey,
  isArabic,
  sortCycle,
  type SortState,
} from '@/components/search/ResultsTable'
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
]

function peopleTable(sort: SortState | null = null) {
  const onSortChange = vi.fn()
  render(
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
})

describe('isArabic', () => {
  it('detects Arabic script fragments', () => {
    expect(isArabic('وهران')).toBe(true)
    expect(isArabic('Oran')).toBe(false)
    expect(isArabic('الجزائر SARL')).toBe(true)
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
    render(
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
    const buttons = screen.getAllByRole('button', { name: /search\./ })
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
    render(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const buttons = screen.getAllByRole('button', { name: /search\./ })
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
    const { rerender } = render(
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
    const { rerender } = render(
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
    render(
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
    const { container } = render(
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
    render(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const row = screen.getByText('SARL X').closest('tr') as HTMLElement
    expect(within(row).getByText('2')).toHaveClass('tabular-nums')
  })

  it('renders size bands through their i18n keys and nulls as em-dash', () => {
    render(
      <ResultsTable tab="companies" rows={COMPANY_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    expect(screen.getByText('search.size.500_plus')).toBeInTheDocument()
    const row = screen.getByText('Société Y').closest('tr') as HTMLElement
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders a zero people count as Western 0', () => {
    render(
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

  it('renders the reveal action slot per row', () => {
    peopleTable()
    expect(screen.getAllByTestId('reveal-slot')).toHaveLength(2)
    expect(screen.getAllByText('common.actions.reveal').length).toBeGreaterThan(1)
  })
})

describe('ResultsTable RTL', () => {
  it('keeps the underlying DOM column order stable in RTL (FR-2)', () => {
    const { container } = render(
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
    const { container } = render(
      <ResultsTable tab="people" rows={PEOPLE_ROWS} sort={null} onSortChange={vi.fn()} />,
    )
    const html = container.innerHTML
    expect(html).not.toMatch(/(^|\s)(left|right)-\S/)
    expect(html).not.toMatch(/(^|\s)(ml|mr|pl|pr)-\S/)
    expect(html).not.toMatch(/text-(left|right)(\s|")/)
  })
})
