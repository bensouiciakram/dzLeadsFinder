'use client'

import { XIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { bandLabelKey, MaybeArabic, wilayaDisplayName } from '@/components/search/results-format'
import { INDUSTRIES } from '@/data/industries'
import { WILAYAS } from '@/data/wilayas'
import type { StagedFilters } from '@/lib/api/search-service'

export type ChipsFacet =
  | 'industries'
  | 'wilayas'
  | 'seniorities'
  | 'sizes'
  | 'keyword'
  | 'includeUnknownSize'

type Chip = {
  key: string
  label: string
  code?: string
  facet: ChipsFacet
  value: number | string | boolean
}

type ActiveFilterChipsProps = {
  filters: StagedFilters
  onRemove: (facet: ChipsFacet, value: number | string | boolean) => void
}

export function ActiveFilterChips({ filters, onRemove }: ActiveFilterChipsProps) {
  const t = useTranslations()
  const locale = useLocale()

  const chips: Chip[] = []
  for (const id of filters.industries) {
    const industry = INDUSTRIES.find((candidate) => candidate.id === id)
    if (industry === undefined) continue
    const name = locale === 'ar' ? industry.name_ar : locale === 'fr' ? industry.name_fr : industry.name_en
    chips.push({ key: `industry-${id}`, label: name, facet: 'industries', value: id })
  }
  for (const code of filters.wilayas) {
    const wilaya = WILAYAS.find((candidate) => candidate.code === code)
    if (wilaya === undefined) continue
    chips.push({
      key: `wilaya-${code}`,
      label: wilayaDisplayName(wilaya, locale),
      code: String(code),
      facet: 'wilayas',
      value: code,
    })
  }
  for (const seniority of filters.seniorities) {
    chips.push({
      key: `seniority-${seniority}`,
      label: t(`search.seniority.${seniority}`),
      facet: 'seniorities',
      value: seniority,
    })
  }
  for (const size of filters.sizes) {
    chips.push({
      key: `size-${size}`,
      label:
        bandLabelKey(size) === null ? size : t(bandLabelKey(size) as string),
      facet: 'sizes',
      value: size,
    })
  }
  if (filters.keyword.trim().length > 0) {
    chips.push({ key: 'keyword', label: filters.keyword, facet: 'keyword', value: filters.keyword })
  }
  if (filters.includeUnknownSize) {
    chips.push({
      key: 'unknown-size',
      label: t('search.filters.include_unknown_size'),
      facet: 'includeUnknownSize',
      value: true,
    })
  }

  if (chips.length === 0) return null

  return (
    <div data-testid="active-filter-chips" className="flex flex-wrap gap-4">
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-muted pe-0 ps-3">
          <span className="text-small">
            {chip.code !== undefined && (
              <span className="tabular-nums">{chip.code}</span>
            )}
            {chip.code !== undefined ? ' — ' : ''}
            <MaybeArabic text={chip.label} />
          </span>
          <button
            type="button"
            aria-label={t('search.results.chip_remove', { name: chip.label })}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-4"
            onClick={() => onRemove(chip.facet, chip.value)}
          >
            <XIcon className="pointer-events-none size-4" />
          </button>
        </span>
      ))}
    </div>
  )
}
