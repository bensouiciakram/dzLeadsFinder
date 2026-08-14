'use client'

import { SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { CheckboxGroup } from '@/components/search/CheckboxGroup'
import { KeywordField } from '@/components/search/KeywordField'
import type { ChipsFacet } from '@/components/search/ActiveFilterChips'
import { useSession } from '@/components/providers/SessionProvider'
import { useUpgradeDialog } from '@/components/providers/UpgradeDialogProvider'
import { usePlan } from '@/hooks/usePlan'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { INDUSTRIES, type Industry } from '@/data/industries'
import {
  EMPTY_FILTERS,
  countActiveFilters,
  type SearchTab,
  type StagedFilters,
} from '@/lib/api/search-service'

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

export type ChipRemoveEvent = {
  facet: ChipsFacet
  value: number | string | boolean
}

export function removeFacetValue(
  filters: StagedFilters,
  facet: ChipsFacet,
  value: number | string | boolean,
): StagedFilters {
  switch (facet) {
    case 'industries':
      return { ...filters, industries: filters.industries.filter((item) => item !== value) }
    case 'wilayas':
      return { ...filters, wilayas: filters.wilayas.filter((item) => item !== value) }
    case 'seniorities':
      return { ...filters, seniorities: filters.seniorities.filter((item) => item !== value) }
    case 'sizes':
      return { ...filters, sizes: filters.sizes.filter((item) => item !== value) }
    case 'keyword':
      return { ...filters, keyword: '' }
    case 'includeUnknownSize':
      return { ...filters, includeUnknownSize: false }
  }
}

export type FilterSidebarProps = {
  tab: SearchTab
  applied?: StagedFilters
  busy?: boolean
  rateLimited?: boolean
  rateLimitMessage?: string
  wilayaField?: ReactNode
  wilayaCount?: number
  chipRemove?: ChipRemoveEvent
  clearNonce?: number
  onClearAllRequest?: () => void
  savedSearchesSlot?: ReactNode
  collapsed?: boolean
  onCollapseRequest?: () => void
  onSubmit: (filters: StagedFilters) => void
}

export function FilterSidebar({
  tab,
  applied,
  busy = false,
  rateLimited = false,
  rateLimitMessage,
  wilayaField,
  wilayaCount = 0,
  chipRemove,
  clearNonce = 0,
  onClearAllRequest,
  savedSearchesSlot,
  collapsed = false,
  onCollapseRequest,
  onSubmit,
}: FilterSidebarProps) {
  const t = useTranslations()
  const locale = useLocale()
  const { user } = useSession()
  const { open: openUpgradeDialog } = useUpgradeDialog()
  // Review P5 (5.7 full review): the daily-limit gate reads the plan
  // query's tier (fresh via the window-focus refetch) with the session
  // fallback — the 5.7 expiry sync never refreshes the open tab's session.
  const { plan } = usePlan({ user })
  const dispatchTier = plan?.tier ?? user?.tier
  const baseId = useId()
  const [draft, setDraft] = useState<StagedFilters>(() => applied ?? EMPTY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const dirtyRef = useRef(false)
  const lastAppliedRef = useRef<StagedFilters | null>(null)

  const updateDraft = (updater: (current: StagedFilters) => StagedFilters) => {
    dirtyRef.current = true
    setDraft(updater)
  }

  useEffect(() => {
    if (applied === undefined || applied === lastAppliedRef.current) return
    lastAppliedRef.current = applied
    if (!dirtyRef.current) setDraft(applied)
  }, [applied])

  useEffect(() => {
    if (chipRemove === undefined) return
    dirtyRef.current = true
    setDraft((current) => removeFacetValue(current, chipRemove.facet, chipRemove.value))
  }, [chipRemove])

  useEffect(() => {
    if (clearNonce === 0) return
    dirtyRef.current = false
    setDraft({ ...EMPTY_FILTERS })
  }, [clearNonce])

  useEffect(() => {
    if (sheetOpen) {
      const frame = requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            '[data-slot="drawer-popup"] [data-slot="drawer-close"]',
          )
          ?.focus()
      })
      return () => cancelAnimationFrame(frame)
    }
  }, [sheetOpen])

  useEffect(() => {
    if (!sheetOpen) return
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)') : null
    if (!media) return
    const onResize = () => {
      if (media.matches) setSheetOpen(false)
    }
    media.addEventListener('change', onResize)
    return () => media.removeEventListener('change', onResize)
  }, [sheetOpen])

  const badgeCount = countActiveFilters({ ...draft, wilayas: [] }) + wilayaCount

  const toggleInList = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  const toggleIndustries = (value: string) => {
    const id = Number(value)
    updateDraft((current) => ({
      ...current,
      industries: current.industries.includes(id)
        ? current.industries.filter((item) => item !== id)
        : [...current.industries, id],
    }))
  }

  const handleApply = () => {
    if (busy) return
    if (rateLimited) {
      // 5.7 (John V7 amendment 4 — the AC's "daily-limit state"): the
      // search 429 is tier-keyed (30/day free, 100/day Starter) — a FREE
      // user's click on the aria-disabled Apply opens the Upgrade Dialog
      // (disabled-but-actionable, EXPERIENCE.md L163). A Starter user at
      // the cap has nothing to upgrade into — message only. The export
      // 5,000/24h limit (FR-20) is tier-independent and stays the
      // come-back-tomorrow message — never a dialog.
      //
      // Review P4 (5.7 full review): the mobile drawer path must close the
      // drawer FIRST — the success path does setSheetOpen(false), the
      // rate-limited path previously didn't (two stacked modals — the
      // stack-depth-1 rule).
      setSheetOpen(false)
      if (dispatchTier === 'free') {
        openUpgradeDialog()
      }
      return
    }
    dirtyRef.current = false
    onSubmit({ ...draft })
    setSheetOpen(false)
  }

  const handleClearAll = () => {
    dirtyRef.current = false
    setDraft({ ...EMPTY_FILTERS })
    onClearAllRequest?.()
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

  const renderGroups = (surface: string) => {
    const groupId = (name: string) => `${baseId}-${surface}-${name}`
    return (
      <div className="flex flex-col gap-5">
        <section data-testid="filter-group">
          <CheckboxGroup
            id={groupId('industry')}
            labelKey="search.filters.industry"
            options={industryOptions}
            selected={draft.industries.map(String)}
            onToggle={toggleIndustries}
            onSelectAll={() => updateDraft((current) => ({ ...current, industries: INDUSTRIES.map((industry) => industry.id) }))}
            onClear={() => updateDraft((current) => ({ ...current, industries: [] }))}
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
              onToggle={(value) => updateDraft((current) => ({ ...current, seniorities: toggleInList(current.seniorities, value) }))}
              onSelectAll={() => updateDraft((current) => ({ ...current, seniorities: SENIORITY_OPTIONS.map((option) => option.value) }))}
              onClear={() => updateDraft((current) => ({ ...current, seniorities: [] }))}
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
              onToggle={(value) => updateDraft((current) => ({ ...current, sizes: toggleInList(current.sizes, value) }))}
              onSelectAll={() => updateDraft((current) => ({ ...current, sizes: SIZE_OPTIONS.map((option) => option.value) }))}
              onClear={() => updateDraft((current) => ({ ...current, sizes: [] }))}
            />
            <label
              htmlFor={groupId('unknown-size')}
              className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 md:min-h-0"
            >
              <Checkbox
                id={groupId('unknown-size')}
                checked={draft.includeUnknownSize}
                onCheckedChange={() => updateDraft((current) => ({ ...current, includeUnknownSize: !current.includeUnknownSize }))}
              />
              <span className="text-small">{t('search.filters.include_unknown_size')}</span>
            </label>
          </section>
        )}

        <section data-testid="filter-group">
          <KeywordField
            id={groupId('keyword')}
            value={draft.keyword}
            onChange={(value) => updateDraft((current) => ({ ...current, keyword: value }))}
          />
        </section>
      </div>
    )
  }

  const renderApply = (surface: string) => {
    const rateLimitId = `${baseId}-${surface}-rate-limit`
    return (
      <div className="p-4">
        {rateLimited && (
          <p id={rateLimitId} className="mb-2 text-caption text-destructive">
            {rateLimitMessage ?? t('search.results.rate_limited')}
          </p>
        )}
        <Button
          className="min-h-11 w-full rounded-md md:min-h-8"
          aria-disabled={busy || rateLimited}
          aria-describedby={rateLimited ? rateLimitId : undefined}
          onClick={handleApply}
        >
          {busy ? t('common.states.loading') : t('search.filters.apply')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <aside
        data-testid="filter-sidebar"
        className={`w-sidebar-width shrink-0 flex-col border-inline-end border-border bg-card ${
          collapsed ? 'hidden' : 'hidden md:flex'
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 className="text-title text-foreground">{t('search.filters.title')}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearAll}
              className="min-h-11 cursor-pointer text-caption text-primary hover:text-primary-hover md:h-8"
            >
              {t('search.filters.clear')}
            </button>
            <button
              type="button"
              onClick={onCollapseRequest}
              aria-label={t('common.actions.close')}
              className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:size-8"
            >
              <XIcon />
            </button>
          </div>
        </div>
        <div className="grow overflow-y-auto px-4 pb-4">
          {renderGroups('aside')}
          {savedSearchesSlot}
        </div>
        <div className="border-t border-border">
          <div className="border-inline-end border-border">{renderApply('aside')}</div>
        </div>
      </aside>

      <Drawer swipeDirection="down" showSwipeHandle open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerTrigger className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-small font-medium md:hidden">
          <SlidersHorizontalIcon className="size-4" />
          <span>{t('search.filters.title')}</span>
          <Badge variant="default" className="rounded-full">
            {badgeCount}
          </Badge>
        </DrawerTrigger>
        <span className="sr-only" role="status">
          {t('search.filters.badge', { count: String(badgeCount) })}
        </span>
        <DrawerContent>
        <DrawerHeader className="relative border-b border-border">
          <DrawerTitle>{t('search.filters.title')}</DrawerTitle>
          <button
            type="button"
            onClick={handleClearAll}
            className="absolute end-14 top-3 min-h-11 cursor-pointer rounded-md text-caption text-primary hover:text-primary-hover md:h-8"
          >
            {t('search.filters.clear')}
          </button>
          <DrawerClose
            aria-label={t('common.actions.close')}
            className="absolute end-4 top-3 inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted md:size-8"
          >
            <XIcon />
          </DrawerClose>
        </DrawerHeader>
          <div className="grow overflow-y-auto p-4">
            {renderGroups('drawer')}
            {savedSearchesSlot}
          </div>
          <DrawerFooter className="border-t border-border">{renderApply('drawer')}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
