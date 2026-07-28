import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WilayaTable from '@/components/wilayas/WilayaTable'
import { WILAYAS } from '@/data/wilayas'

const PROPS = {
  wilayas: WILAYAS,
  filterLabel: 'Filter wilayas',
  filterPlaceholder: 'Search by code or name...',
  noResults: 'No wilayas match your search',
  columnCode: 'Code',
  columnArabic: 'Arabic',
  columnFrench: 'French',
  columnEnglish: 'English',
  tableCaption: 'The 58 wilayas of Algeria',
}

describe('WilayaTable', () => {
  it('renders all 58 rows', () => {
    render(<WilayaTable {...PROPS} />)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(59)
  })

  it('renders table with caption', () => {
    render(<WilayaTable {...PROPS} />)
    expect(screen.getByText(PROPS.tableCaption)).toBeInTheDocument()
  })

  it('renders column headers with scope col', () => {
    render(<WilayaTable {...PROPS} />)
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(4)
    headers.forEach((h) => expect(h).toHaveAttribute('scope', 'col'))
  })

  it('sets lang attribute on name cells', () => {
    render(<WilayaTable {...PROPS} />)
    const arabicCell = screen.getByText('أدرار')
    expect(arabicCell).toHaveAttribute('lang', 'ar')

    const cellTwo = screen.getAllByText('Adrar')
    expect(cellTwo[0]).toHaveAttribute('lang', 'fr')
    expect(cellTwo[1]).toHaveAttribute('lang', 'en')
  })

  it('renders input with visible label', () => {
    render(<WilayaTable {...PROPS} />)
    const input = screen.getByLabelText('Filter wilayas')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'search')
  })

  it('filters rows by code', () => {
    render(<WilayaTable {...PROPS} />)
    const input = screen.getByLabelText('Filter wilayas')
    fireEvent.change(input, { target: { value: '31' } })
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(screen.getAllByText(/Oran/).length).toBeGreaterThanOrEqual(1)
  })

  it('filters rows by arabic name', () => {
    render(<WilayaTable {...PROPS} />)
    const input = screen.getByLabelText('Filter wilayas')
    fireEvent.change(input, { target: { value: 'وهر' } })
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('وهران')).toBeInTheDocument()
  })

  it('filters rows by french name', () => {
    render(<WilayaTable {...PROPS} />)
    const input = screen.getByLabelText('Filter wilayas')
    fireEvent.change(input, { target: { value: 'oran' } })
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(2)
    const orans = screen.getAllByText(/Oran/)
    expect(orans.length).toBeGreaterThanOrEqual(1)
  })

  it('shows no results message when filter matches nothing', () => {
    render(<WilayaTable {...PROPS} />)
    const input = screen.getByLabelText('Filter wilayas')
    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(screen.getByText('No wilayas match your search')).toBeInTheDocument()
  })

  it('uses tabular-nums on code cells', () => {
    render(<WilayaTable {...PROPS} />)
    const codeCells = screen.getAllByRole('rowheader')
    codeCells.forEach((cell) => {
      expect(cell.className).toContain('tabular-nums')
    })
  })

  it('renders codes 1-58 in order', () => {
    render(<WilayaTable {...PROPS} />)
    const codeCells = screen.getAllByRole('rowheader')
    expect(codeCells).toHaveLength(58)
    expect(codeCells[0]).toHaveTextContent('01')
    expect(codeCells[57]).toHaveTextContent('58')
  })
})
