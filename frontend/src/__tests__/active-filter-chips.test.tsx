import { render, screen, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActiveFilterChips } from '@/components/search/ActiveFilterChips'
import { EMPTY_FILTERS, type StagedFilters } from '@/lib/api/search-service'

const FILTERS: StagedFilters = {
  industries: [1, 4],
  wilayas: [31, 16],
  seniorities: ['director'],
  sizes: ['1-10'],
  includeUnknownSize: true,
  keyword: 'oran',
}

function renderChips(filters: StagedFilters = FILTERS) {
  const onRemove = vi.fn()
  const view = render(<ActiveFilterChips filters={filters} onRemove={onRemove} />)
  return { onRemove, ...view }
}

function chipLabels(): string[] {
  const container = screen.getByTestId('active-filter-chips')
  return Array.from(container.querySelectorAll('span[class*="rounded-full"]')).map(
    (chip) => chip.querySelector('span.text-small')?.textContent ?? '',
  )
}

describe('ActiveFilterChips', () => {
  it('renders one chip per active filter value in spec order', () => {
    renderChips()
    const labels = chipLabels().join('|')
    expect(labels).toContain('Construction')
    expect(labels).toContain('Advertising')
    expect(labels).toContain('31 — Oran')
    expect(labels).toContain('16 — Algiers')
    expect(labels).toContain('search.seniority.director')
    expect(labels).toContain('search.size.1_10')
    expect(labels).toContain('oran')
    expect(labels).toContain('search.filters.include_unknown_size')
  })

  it('orders chips industries -> wilayas -> seniorities -> sizes -> keyword -> unknown-size', () => {
    renderChips()
    expect(chipLabels()).toEqual([
      'Construction',
      'Advertising',
      '31 — Oran',
      '16 — Algiers',
      'search.seniority.director',
      'search.size.1_10',
      'oran',
      'search.filters.include_unknown_size',
    ])
  })

  it('renders nothing when no filters are active', () => {
    const { container } = render(
      <ActiveFilterChips filters={EMPTY_FILTERS} onRemove={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('reports an industry removal with its facet and value', () => {
    const { onRemove } = renderChips()
    const container = screen.getByTestId('active-filter-chips')
    const remove = container.querySelector('button')
    fireEvent.click(remove!)
    expect(onRemove).toHaveBeenCalledWith('industries', 1)
  })

  it('reports a wilaya removal with its code', () => {
    const { onRemove } = renderChips()
    const container = screen.getByTestId('active-filter-chips')
    const wilayaChip = Array.from(
      container.querySelectorAll('span[class*="rounded-full"]'),
    ).find((chip) => chip.querySelector('span.text-small')?.textContent === '31 — Oran') as HTMLElement
    fireEvent.click(within(wilayaChip).getByRole('button'))
    expect(onRemove).toHaveBeenCalledWith('wilayas', 31)
  })

  it('reports the keyword removal', () => {
    const { onRemove } = renderChips()
    const container = screen.getByTestId('active-filter-chips')
    const keywordChip = Array.from(
      container.querySelectorAll('span[class*="rounded-full"]'),
    ).find((chip) => chip.querySelector('span.text-small')?.textContent === 'oran') as HTMLElement
    fireEvent.click(within(keywordChip).getByRole('button'))
    expect(onRemove).toHaveBeenCalledWith('keyword', 'oran')
  })

  it('reports the unknown-size toggle removal', () => {
    const { onRemove } = renderChips()
    const container = screen.getByTestId('active-filter-chips')
    const toggleChip = Array.from(
      container.querySelectorAll('span[class*="rounded-full"]'),
    ).find(
      (chip) =>
        chip.querySelector('span.text-small')?.textContent ===
        'search.filters.include_unknown_size',
    ) as HTMLElement
    fireEvent.click(within(toggleChip).getByRole('button'))
    expect(onRemove).toHaveBeenCalledWith('includeUnknownSize', true)
  })

  it('gives every remove button a labelled, keyboard-reachable 44px target', () => {
    renderChips()
    const container = screen.getByTestId('active-filter-chips')
    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons.length).toBe(8)
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button')
      expect(button.getAttribute('aria-label')).toMatch(/^search\.results\.chip_remove/)
      expect(button).toHaveClass('size-11')
    }
  })

  it('renders the wilaya code with tabular numerals', () => {
    renderChips()
    const container = screen.getByTestId('active-filter-chips')
    const code = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === '31',
    )
    expect(code).toBeDefined()
    expect(code).toHaveClass('tabular-nums')
  })

  it('renders an unknown size band as its raw value rather than an i18n key', () => {
    const { onRemove } = renderChips({ ...EMPTY_FILTERS, sizes: ['1000+'] })
    expect(chipLabels()).toEqual(['1000+'])
    const container = screen.getByTestId('active-filter-chips')
    const chip = container.querySelector('span[class*="rounded-full"]') as HTMLElement
    fireEvent.click(within(chip).getByRole('button'))
    expect(onRemove).toHaveBeenCalledWith('sizes', '1000+')
  })

  it('uses no physical-property classes in the chip markup', () => {
    const { container } = renderChips()
    const html = container.innerHTML
    expect(html).not.toMatch(/(^|\s)(left|right)-\S/)
    expect(html).not.toMatch(/(^|\s)(ml|mr|pl|pr)-\S/)
  })
})
