'use client'

import { Combobox as BaseCombobox } from '@base-ui/react'
import { XIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState, type KeyboardEvent } from 'react'

import {
  Combobox,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { WILAYAS, type Wilaya } from '@/data/wilayas'

const CHIP_LIMIT = 3

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/

export function wilayaDisplayName(wilaya: Wilaya, locale: string): string {
  if (locale === 'ar') return wilaya.name_ar
  if (locale === 'fr') return wilaya.name_fr || wilaya.name_ar
  return wilaya.name_en || wilaya.name_ar
}

export function wilayaDisplayLabel(wilaya: Wilaya, locale: string): string {
  return `${wilaya.code} — ${wilayaDisplayName(wilaya, locale)}`
}

export function filterWilayas(wilayas: Wilaya[], query: string): Wilaya[] {
  const q = query.trim().toLowerCase().replace(/^0+(?=\d)/, '')
  if (!q) return wilayas
  return wilayas.filter(
    (wilaya) =>
      String(wilaya.code).startsWith(q) ||
      wilaya.name_ar.toLowerCase().includes(q) ||
      wilaya.name_fr.toLowerCase().includes(q) ||
      wilaya.name_en.toLowerCase().includes(q),
  )
}

export type WilayaComboboxProps = {
  value: number[]
  onChange: (codes: number[]) => void
  inputValue?: string
  onInputValueChange?: (query: string) => void
}

export function WilayaCombobox({
  value,
  onChange,
  inputValue,
  onInputValueChange,
}: WilayaComboboxProps) {
  const t = useTranslations()
  const locale = useLocale()
  const anchor = useComboboxAnchor()
  const [internalQuery, setInternalQuery] = useState('')

  const query = inputValue ?? internalQuery
  const handleQueryChange = (next: string) => {
    setInternalQuery(next)
    onInputValueChange?.(next)
  }

  const selected = useMemo(() => {
    const byCode = new Map<number, Wilaya>()
    for (const code of value) {
      const wilaya = WILAYAS.find((candidate) => candidate.code === code)
      if (wilaya && !byCode.has(code)) byCode.set(code, wilaya)
    }
    return Array.from(byCode.values())
  }, [value])

  const options = useMemo(() => filterWilayas(WILAYAS, query), [query])

  const update = (codes: number[]) => {
    onChange(codes)
    handleQueryChange('')
  }

  const removeChip = (code: number) => {
    update(value.filter((candidate) => candidate !== code))
  }

  const suppressBaseUI = (event: KeyboardEvent<HTMLInputElement>) => {
    const withSuppression = event as KeyboardEvent<HTMLInputElement> & {
      preventBaseUIHandler?: () => void
    }
    withSuppression.preventBaseUIHandler?.()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const withComposition = event as KeyboardEvent<HTMLInputElement> & { isComposing?: boolean }
    if (event.nativeEvent.isComposing || withComposition.isComposing) {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        suppressBaseUI(event)
      }
      return
    }
    if (event.key === 'Escape') {
      const popupOpen = event.currentTarget.getAttribute('aria-expanded') === 'true'
      if (!popupOpen) {
        event.preventDefault()
        suppressBaseUI(event)
        handleQueryChange('')
      }
      return
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && query === '' && selected.length > 0) {
      event.preventDefault()
      suppressBaseUI(event)
      update(value.filter((code) => code !== selected[selected.length - 1].code))
    }
  }

  return (
    <Combobox
      multiple
      filter={null}
      items={options}
      value={selected}
      onValueChange={(wilayas) => update(wilayas.map((wilaya) => wilaya.code))}
      inputValue={query}
      onInputValueChange={handleQueryChange}
    >
      <BaseCombobox.Chips
        ref={anchor}
        data-testid="wilaya-chips"
        className="flex min-h-11 flex-wrap items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50 md:min-h-8"
      >
        <ComboboxValue>
          {(values: Wilaya[]) => (
            <>
              {values.slice(0, CHIP_LIMIT).map((wilaya) => (
                <ComboboxChip
                  key={wilaya.code}
                  showRemove={false}
                  aria-label={wilayaDisplayLabel(wilaya, locale)}
                  className="rounded-full"
                >
                  <span className="tabular-nums">{wilaya.code}</span>
                  <span className="text-muted-foreground">—</span>
                  <WilayaName wilaya={wilaya} locale={locale} />
                  <button
                    type="button"
                    aria-label={t('search.filters.wilaya_remove', {
                      name: wilayaDisplayName(wilaya, locale),
                    })}
                    className="ms-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-4"
                    onClick={() => removeChip(wilaya.code)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        event.stopPropagation()
                        removeChip(wilaya.code)
                      }
                    }}
                  >
                    <XIcon className="pointer-events-none size-4" />
                  </button>
                </ComboboxChip>
              ))}
              {values.length > CHIP_LIMIT && (
                <span className="text-caption text-muted-foreground">
                  {t('search.filters.wilaya_more', { count: String(values.length - CHIP_LIMIT) })}
                </span>
              )}
              <ComboboxChipsInput
                aria-label={t('search.filters.wilaya_label')}
                placeholder={values.length > 0 ? undefined : t('search.filters.wilaya_placeholder')}
                onKeyDown={handleInputKeyDown}
              />
            </>
          )}
        </ComboboxValue>
        {selected.length > 0 && (
          <button
            type="button"
            aria-label={t('search.filters.wilaya_clear')}
            className="ms-1 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-4"
            onClick={() => update([])}
          >
            <XIcon className="pointer-events-none size-4" />
          </button>
        )}
      </BaseCombobox.Chips>
      <ComboboxContent anchor={anchor} aria-label={t('search.filters.wilaya')}>
        <ComboboxEmpty>{t('trust.wilayas.no_results')}</ComboboxEmpty>
        <ComboboxList className="max-h-70">
          {(wilaya: Wilaya) => (
            <ComboboxItem
              key={wilaya.code}
              value={wilaya}
              className="min-h-11 data-highlighted:bg-muted md:min-h-8"
            >
              <span className="tabular-nums">{wilaya.code}</span>
              <span className="text-muted-foreground">—</span>
              <WilayaName wilaya={wilaya} locale={locale} />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function WilayaName({ wilaya, locale }: { wilaya: Wilaya; locale: string }) {
  const name = wilayaDisplayName(wilaya, locale)
  if (ARABIC_SCRIPT_RE.test(name)) {
    return (
      <span lang="ar" dir="rtl">
        {name}
      </span>
    )
  }
  return <span>{name}</span>
}
