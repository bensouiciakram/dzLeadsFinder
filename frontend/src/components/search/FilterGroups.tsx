'use client'

import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode } from 'react'

import { CheckboxGroup } from '@/components/search/CheckboxGroup'
import { KeywordField } from '@/components/search/KeywordField'
import { Checkbox } from '@/components/ui/checkbox'
import { INDUSTRIES, type Industry } from '@/data/industries'
import type { SearchTab, StagedFilters } from '@/lib/api/search-service'

const SENIORITY_OPTIONS = [
  { value: 'owner_founder', labelKey: 'search.seniority.owner_founder' },
  { value: 'c_level', labelKey: 'search.seniority.c_level' },
  { value: 'director', labelKey: 'search.seniority.director' },
  { value: 'manager', labelKey: 'search.seniority.manager' },
  { value: 'individual_contributor', labelKey: 'search.seniority.individual_contributor' },
]

const SIZE_OPTIONS = [
  { value: '1-10', labelKey: 'search.size.1_10' },
  { value: '11-50', labelKey: 'search.size.11_50' },
  { value: '51-200', labelKey: 'search.size.51_200' },
  { value: '201-500', labelKey: 'search.size.201_500' },
  { value: '500+', labelKey: 'search.size.500_plus' },
]

function industryName(industry: Industry, locale: string): string {
  if (locale === 'ar') return industry.name_ar
  if (locale === 'fr') return industry.name_fr
  return industry.name_en
}

type FilterGroupsProps = {
  tab: SearchTab
  draft: StagedFilters
  onDraftChange: (updater: (current: StagedFilters) => StagedFilters) => void
  wilayaField?: ReactNode
  // Namespace for the per-surface control ids (aside vs mobile panel render
  // simultaneously on small screens — labels must never collide).
  idPrefix: string
}

export function FilterGroups({
  tab,
  draft,
  onDraftChange,
  wilayaField,
  idPrefix,
}: FilterGroupsProps) {
  const t = useTranslations()
  const locale = useLocale()

  const groupId = (name: string) => `${idPrefix}-${name}`

  const toggleInList = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const toggleIndustries = (value: string) => {
    const id = Number(value)
    onDraftChange((current) => ({
      ...current,
      industries: current.industries.includes(id)
        ? current.industries.filter((item) => item !== id)
        : [...current.industries, id],
    }))
  }

  const industryOptions = INDUSTRIES.map((industry) => ({
    value: String(industry.id),
    label: industryName(industry, locale),
  }))

  const seniorityOptions = SENIORITY_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  const sizeOptions = SIZE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  return (
    <div className="flex flex-col gap-5">
      <section data-testid="filter-group">
        <CheckboxGroup
          id={groupId('industry')}
          labelKey="search.filters.industry"
          options={industryOptions}
          selected={draft.industries.map(String)}
          onToggle={toggleIndustries}
          onSelectAll={() => onDraftChange((current) => ({ ...current, industries: INDUSTRIES.map((industry) => industry.id) }))}
          onClear={() => onDraftChange((current) => ({ ...current, industries: [] }))}
          maxVisible={8}
        />
      </section>

      <section data-testid="filter-group">
        <h3 className="text-caption text-muted-foreground">{t('search.filters.wilaya')}</h3>
        <div className="mt-2">{wilayaField}</div>
      </section>

      {tab === 'people' && (
        <section data-testid="filter-group">
          <CheckboxGroup
            id={groupId('seniority')}
            labelKey="search.filters.seniority"
            options={seniorityOptions}
            selected={draft.seniorities}
            onToggle={(value) => onDraftChange((current) => ({ ...current, seniorities: toggleInList(current.seniorities, value) }))}
            onSelectAll={() => onDraftChange((current) => ({ ...current, seniorities: SENIORITY_OPTIONS.map((option) => option.value) }))}
            onClear={() => onDraftChange((current) => ({ ...current, seniorities: [] }))}
          />
        </section>
      )}

      {tab === 'companies' && (
        <section data-testid="filter-group">
          <CheckboxGroup
            id={groupId('size')}
            labelKey="search.filters.size"
            options={sizeOptions}
            selected={draft.sizes}
            onToggle={(value) => onDraftChange((current) => ({ ...current, sizes: toggleInList(current.sizes, value) }))}
            onSelectAll={() => onDraftChange((current) => ({ ...current, sizes: SIZE_OPTIONS.map((option) => option.value) }))}
            onClear={() => onDraftChange((current) => ({ ...current, sizes: [] }))}
          />
          <label
            htmlFor={groupId('unknown-size')}
            className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 md:min-h-0"
          >
            <Checkbox
              id={groupId('unknown-size')}
              checked={draft.includeUnknownSize}
              onCheckedChange={() => onDraftChange((current) => ({ ...current, includeUnknownSize: !current.includeUnknownSize }))}
            />
            <span className="text-small">{t('search.filters.include_unknown_size')}</span>
          </label>
        </section>
      )}

      <section data-testid="filter-group">
        <KeywordField
          id={groupId('keyword')}
          value={draft.keyword}
          onChange={(value) => onDraftChange((current) => ({ ...current, keyword: value }))}
        />
      </section>
    </div>
  )
}
