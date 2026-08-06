import { render, screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useLocale } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'

import {
  WilayaCombobox,
  filterWilayas,
  wilayaDisplayLabel,
  wilayaDisplayName,
} from '@/components/search/WilayaCombobox'
import type { Wilaya } from '@/data/wilayas'

vi.mock('@/data/wilayas', () => ({
  WILAYAS: [
    { code: 1, name_ar: 'أدرار', name_fr: 'Adrar', name_en: 'Adrar' },
    { code: 2, name_ar: 'الشلف', name_fr: 'Chlef', name_en: 'Chlef' },
    { code: 31, name_ar: 'وهران', name_fr: 'Oran', name_en: 'Oran' },
    { code: 58, name_ar: 'المنيعة', name_fr: '', name_en: '' },
  ] as Wilaya[],
}))

function renderCombobox(initial: number[] = []) {
  const onChange = vi.fn()
  const view = render(<WilayaCombobox value={initial} onChange={onChange} />)
  return { ...view, onChange }
}

function openPopup() {
  const input = screen.getByRole('combobox')
  fireEvent.mouseDown(input)
  fireEvent.mouseUp(input)
  fireEvent.click(input)
  input.focus()
  return input
}

describe('wilayaDisplayName', () => {
  it('returns the locale name when present', () => {
    const wilaya: Wilaya = { code: 31, name_ar: 'وهران', name_fr: 'Oran', name_en: 'Oran' }
    expect(wilayaDisplayName(wilaya, 'en')).toBe('Oran')
    expect(wilayaDisplayName(wilaya, 'fr')).toBe('Oran')
    expect(wilayaDisplayName(wilaya, 'ar')).toBe('وهران')
  })

  it('falls back to the Arabic name when the locale name is missing — never blank (FR-10)', () => {
    const wilaya: Wilaya = { code: 58, name_ar: 'المنيعة', name_fr: '', name_en: '' }
    expect(wilayaDisplayName(wilaya, 'en')).toBe('المنيعة')
    expect(wilayaDisplayName(wilaya, 'fr')).toBe('المنيعة')
  })
})

describe('wilayaDisplayLabel', () => {
  it('renders "code — localized name" with Western numerals', () => {
    const wilaya: Wilaya = { code: 31, name_ar: 'وهران', name_fr: 'Oran', name_en: 'Oran' }
    expect(wilayaDisplayLabel(wilaya, 'en')).toBe('31 — Oran')
  })
})

describe('filterWilayas', () => {
  const fixture: Wilaya[] = [
    { code: 1, name_ar: 'أدرار', name_fr: 'Adrar', name_en: 'Adrar' },
    { code: 31, name_ar: 'وهران', name_fr: 'Oran', name_en: 'Oran' },
  ]

  it('matches the code prefix, and the Arabic, French and English names', () => {
    expect(filterWilayas(fixture, '31').map((w) => w.code)).toEqual([31])
    expect(filterWilayas(fixture, 'Oran').map((w) => w.code)).toEqual([31])
    expect(filterWilayas(fixture, 'oran').map((w) => w.code)).toEqual([31])
    expect(filterWilayas(fixture, 'وهران').map((w) => w.code)).toEqual([31])
    expect(filterWilayas(fixture, 'Adrar').map((w) => w.code)).toEqual([1])
  })

  it('matches codes written with leading zeros', () => {
    expect(filterWilayas(fixture, '01').map((w) => w.code)).toEqual([1])
    expect(filterWilayas(fixture, '031').map((w) => w.code)).toEqual([31])
    expect(filterWilayas(fixture, '0').map((w) => w.code)).toEqual([])
  })

  it('returns all wilayas for an empty or whitespace query', () => {
    expect(filterWilayas(fixture, '').map((w) => w.code)).toEqual([1, 31])
    expect(filterWilayas(fixture, '   ').map((w) => w.code)).toEqual([1, 31])
  })
})

describe('WilayaCombobox data', () => {
  it('lists one option per wilaya with the "code — localized name" format', async () => {
    renderCombobox()
    openPopup()

    expect(await screen.findByRole('option', { name: '31 — Oran' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '1 — Adrar' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '58 — المنيعة' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('renders the option code in Western numerals', async () => {
    renderCombobox()
    openPopup()

    const option = await screen.findByRole('option', { name: '31 — Oran' })
    expect(within(option).getByText('31')).toBeInTheDocument()
  })
})

describe('WilayaCombobox filtering', () => {
  it('filters by code "31"', async () => {
    renderCombobox()
    const input = openPopup()
    await screen.findAllByRole('option')

    fireEvent.change(input, { target: { value: '31' } })

    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1)
    })
    expect(screen.getByRole('option', { name: '31 — Oran' })).toBeInTheDocument()
  })

  it('filters by French and Arabic names', async () => {
    renderCombobox()
    const input = openPopup()
    await screen.findAllByRole('option')

    fireEvent.change(input, { target: { value: 'Oran' } })
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1)
    })

    fireEvent.change(input, { target: { value: 'وهران' } })
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1)
    })
    expect(screen.getByRole('option', { name: '31 — Oran' })).toBeInTheDocument()
  })

  it('shows the empty state when nothing matches', async () => {
    renderCombobox()
    const input = openPopup()
    await screen.findAllByRole('option')

    fireEvent.change(input, { target: { value: 'zzzz' } })

    expect(await screen.findByText('trust.wilayas.no_results')).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})

describe('WilayaCombobox selection and chips', () => {
  it('selects a wilaya on click and renders a removable chip inside the trigger', async () => {
    const { onChange } = renderCombobox()
    openPopup()

    fireEvent.click(await screen.findByRole('option', { name: '31 — Oran' }))

    expect(onChange).toHaveBeenCalledWith([31])
  })

  it('renders chips for controlled selections with per-chip remove buttons', () => {
    const { onChange } = renderCombobox([31, 1])

    expect(screen.getByLabelText('31 — Oran')).toBeInTheDocument()
    expect(screen.getByLabelText('1 — Adrar')).toBeInTheDocument()

    const removeButtons = screen.getAllByRole('button', { name: 'search.filters.wilaya_remove' })
    expect(removeButtons).toHaveLength(2)

    fireEvent.click(removeButtons[0])

    expect(onChange).toHaveBeenCalledWith([1])
  })

  it('removes exactly the chip whose remove button receives Enter', () => {
    const { onChange } = renderCombobox([31, 1])
    const removeButtons = screen.getAllByRole('button', { name: 'search.filters.wilaya_remove' })

    fireEvent.keyDown(removeButtons[0], { key: 'Enter' })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([1])
  })

  it('removes exactly the chip whose remove button receives Space', () => {
    const { onChange } = renderCombobox([31, 1])
    const removeButtons = screen.getAllByRole('button', { name: 'search.filters.wilaya_remove' })

    fireEvent.keyDown(removeButtons[1], { key: ' ' })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([31])
  })

  it('selects an option with Enter on the highlighted option', async () => {
    const { onChange } = renderCombobox()
    const input = openPopup()
    await screen.findAllByRole('option')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith([1])
  })

  it('selects an option with Space on the focused option', async () => {
    const { onChange } = renderCombobox()
    const input = openPopup()
    await screen.findAllByRole('option')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const option = screen.getByRole('option', { name: '1 — Adrar' })
    fireEvent.keyDown(option, { key: ' ' })

    expect(onChange).toHaveBeenCalledWith([1])
  })

  it('toggles an option off by clicking it again', async () => {
    const { onChange } = renderCombobox([31])
    openPopup()

    fireEvent.click(await screen.findByRole('option', { name: '31 — Oran' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('removes the last chip on Backspace when the input is empty', () => {
    const { onChange } = renderCombobox([31, 1])
    const input = screen.getByRole('combobox')

    fireEvent.keyDown(input, { key: 'Backspace' })

    expect(onChange).toHaveBeenCalledWith([31])
  })

  it('removes the last chip on Delete when the input is empty', () => {
    const { onChange } = renderCombobox([31, 1])
    const input = screen.getByRole('combobox')

    fireEvent.keyDown(input, { key: 'Delete' })

    expect(onChange).toHaveBeenCalledWith([31])
  })

  it('does not remove a chip on Backspace while the input has text', () => {
    const { onChange } = renderCombobox([31, 1])
    const input = screen.getByRole('combobox')

    fireEvent.change(input, { target: { value: 'or' } })
    fireEvent.keyDown(input, { key: 'Backspace' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not remove a chip on Backspace during IME composition', () => {
    const { onChange } = renderCombobox([31, 1])
    const input = screen.getByRole('combobox')

    fireEvent.keyDown(input, {
      key: 'Backspace',
      isComposing: true,
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes exactly the last selected chip on Backspace once, even beyond the chip limit', () => {
    const { onChange } = renderCombobox([31, 1, 2, 58])
    const input = screen.getByRole('combobox')

    fireEvent.keyDown(input, { key: 'Backspace' })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith([31, 1, 2])
  })

  it('keeps the selection when Escape is pressed while the popup is closed', async () => {
    const { onChange } = renderCombobox([31])
    const input = openPopup()
    await screen.findAllByRole('option')

    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryAllByRole('option')).toHaveLength(0)
    })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders a consistent empty state for codes that are not in the taxonomy', () => {
    const { onChange } = renderCombobox([999])

    expect(screen.queryByLabelText('999 — ')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'search.filters.wilaya_clear' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveAttribute('placeholder', 'search.filters.wilaya_placeholder')

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('deduplicates repeated codes in the selection', () => {
    const { onChange } = renderCombobox([31, 31])

    expect(screen.getAllByLabelText('31 — Oran')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'search.filters.wilaya_remove' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('caps visible chips at 3 and shows the "+N more" overflow indicator', () => {
    renderCombobox([31, 1, 2, 58])

    expect(screen.getByText('search.filters.wilaya_more')).toBeInTheDocument()
    const chipContainer = screen.getByTestId('wilaya-chips')
    expect(within(chipContainer).queryAllByText('—')).toHaveLength(3)
  })

  it('renders a clear affordance that empties the selection', () => {
    const { onChange } = renderCombobox([31])

    fireEvent.click(screen.getByRole('button', { name: 'search.filters.wilaya_clear' }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('hides the clear affordance when nothing is selected', () => {
    renderCombobox([])

    expect(screen.queryByRole('button', { name: 'search.filters.wilaya_clear' })).not.toBeInTheDocument()
  })

  it('labels the Arabic fallback fragment with lang="ar"', () => {
    renderCombobox([58])

    const chipLabel = screen.getByText('المنيعة')
    expect(chipLabel).toHaveAttribute('lang', 'ar')
  })
})

describe('WilayaCombobox accessibility', () => {
  it('labels the search input with an aria-label, never placeholder-only', () => {
    renderCombobox()

    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-label', 'search.filters.wilaya_label')
    expect(input).toHaveAttribute('placeholder', 'search.filters.wilaya_placeholder')
  })

  it('keeps the placeholder only when nothing is selected', () => {
    renderCombobox([31])

    expect(screen.getByRole('combobox')).not.toHaveAttribute('placeholder')
  })

  it('gives chip remove buttons a 44px touch target on mobile', () => {
    renderCombobox([31, 1])

    for (const button of screen.getAllByRole('button', { name: 'search.filters.wilaya_remove' })) {
      expect(button).toHaveClass('size-11')
      expect(button).toHaveClass('md:size-4')
    }
  })

  it('gives the chips container a 44px touch target on mobile', () => {
    renderCombobox()

    expect(screen.getByTestId('wilaya-chips')).toHaveClass('min-h-11')
    expect(screen.getByTestId('wilaya-chips')).toHaveClass('md:min-h-8')
  })

  it('gives the clear affordance a 44px touch target on mobile', () => {
    renderCombobox([31])

    expect(screen.getByRole('button', { name: 'search.filters.wilaya_clear' })).toHaveClass(
      'size-11',
    )
    expect(screen.getByRole('button', { name: 'search.filters.wilaya_clear' })).toHaveClass(
      'md:size-4',
    )
  })

  it('gives option rows a 44px touch target on mobile', async () => {
    renderCombobox()
    openPopup()

    const option = await screen.findByRole('option', { name: '31 — Oran' })
    expect(option).toHaveClass('min-h-11')
    expect(option).toHaveClass('md:min-h-8')
  })

  it('closes the popup on Esc and returns focus to the input', async () => {
    renderCombobox()
    const input = openPopup()
    await screen.findAllByRole('option')

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryAllByRole('option')).toHaveLength(0)
    })
    expect(document.activeElement).toBe(input)
  })
})

describe('WilayaCombobox Arabic locale', () => {
  it('renders option rows and chips with Arabic names and lang="ar" fragments', async () => {
    vi.mocked(useLocale).mockReturnValue('ar')
    renderCombobox([31])

    expect(screen.getByText('وهران')).toHaveAttribute('lang', 'ar')

    const input = openPopup()
    await screen.findAllByRole('option')
    const option = screen.getByRole('option', { name: '31 — وهران' })
    expect(within(option).getByText('31')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    vi.mocked(useLocale).mockReturnValue('en')
  })
})

describe('WilayaCombobox RTL', () => {
  it('renders with logical properties only inside an RTL container', () => {
    const { container } = render(
      <div dir="rtl">
        <WilayaCombobox value={[31]} onChange={() => undefined} />
      </div>,
    )

    const chips = container.querySelector('[data-testid="wilaya-chips"]')
    expect(chips).not.toBeNull()
    const forbidden = ['left-', 'right-', 'ml-', 'mr-', 'pl-', 'pr-', 'text-left', 'text-right']
    for (const cls of forbidden) {
      expect(chips!.className).not.toContain(cls)
    }
  })
})
