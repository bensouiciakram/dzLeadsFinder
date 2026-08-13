import { render, screen, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CheckboxGroup } from '@/components/search/CheckboxGroup'

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
]

function renderGroup(overrides: Partial<Parameters<typeof CheckboxGroup>[0]> = {}) {
  const props = {
    id: 'group-id',
    labelKey: 'group.label',
    options: OPTIONS,
    selected: [] as string[],
    onToggle: vi.fn(),
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  }
  return { ...render(<CheckboxGroup {...props} />), props }
}

describe('CheckboxGroup', () => {
  it('renders the caption label and one labelled checkbox per option', () => {
    renderGroup()

    const group = screen.getByRole('group', { name: 'group.label' })
    expect(within(group).getByText('group.label')).toHaveClass('text-caption')
    expect(screen.getByRole('checkbox', { name: 'Option A' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Option B' })).toBeInTheDocument()
  })

  it('checks exactly the selected options', () => {
    renderGroup({ selected: ['b'] })

    expect(screen.getByRole('checkbox', { name: 'Option A' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Option B' })).toBeChecked()
  })

  it('calls onToggle when an option is toggled', () => {
    const { props } = renderGroup()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Option A' }))

    expect(props.onToggle).toHaveBeenCalledTimes(1)
    expect(props.onToggle).toHaveBeenCalledWith('a')
  })

  it('shows Select all when none or some options are selected', () => {
    const { props } = renderGroup()
    expect(screen.getByRole('button', { name: 'search.filters.select_all' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.select_all' }))
    expect(props.onSelectAll).toHaveBeenCalledTimes(1)
    expect(props.onClear).not.toHaveBeenCalled()
  })

  it('switches the affordance to Clear when all options are selected', () => {
    const { props } = renderGroup({ selected: ['a', 'b'] })

    const clear = screen.getByRole('button', { name: 'search.filters.clear_group' })
    fireEvent.click(clear)

    expect(props.onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'search.filters.select_all' })).not.toBeInTheDocument()
  })

  it('gives every option row a 44px touch target on mobile', () => {
    renderGroup()

    const row = screen.getByRole('checkbox', { name: 'Option A' }).closest('label')
    expect(row).toHaveClass('min-h-11')
    expect(row).toHaveClass('md:min-h-0')
  })

  it('gives the Select-all toggle a 44px touch target on mobile', () => {
    renderGroup()

    expect(screen.getByRole('button', { name: 'search.filters.select_all' })).toHaveClass('min-h-11')
    expect(screen.getByRole('button', { name: 'search.filters.select_all' })).toHaveClass('md:h-8')
  })
})

describe('CheckboxGroup collapse (maxVisible)', () => {
  const MANY_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
    value: String(index),
    label: `Option ${index}`,
  }))

  it('renders only the first maxVisible options plus a Show more toggle', () => {
    renderGroup({ options: MANY_OPTIONS, maxVisible: 4 })

    expect(screen.getByRole('checkbox', { name: 'Option 0' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Option 3' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Option 4' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'search.filters.show_more' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps a selected option beyond the cutoff visible while collapsed', () => {
    renderGroup({ options: MANY_OPTIONS, maxVisible: 4, selected: ['7'] })

    expect(screen.getByRole('checkbox', { name: 'Option 7' })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Option 8' })).not.toBeInTheDocument()
  })

  it('expands and collapses on the toggle', () => {
    renderGroup({ options: MANY_OPTIONS, maxVisible: 4 })

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.show_more' }))
    expect(screen.getByRole('checkbox', { name: 'Option 9' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'search.filters.show_less' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.show_less' }))
    expect(screen.queryByRole('checkbox', { name: 'Option 9' })).not.toBeInTheDocument()
  })

  it('hides the toggle when options fit within maxVisible', () => {
    renderGroup({ maxVisible: 4 })

    expect(screen.queryByRole('button', { name: 'search.filters.show_more' })).not.toBeInTheDocument()
  })
})
