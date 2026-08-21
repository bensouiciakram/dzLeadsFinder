'use client'

import { ChevronDownIcon, ChevronUpIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'

import { FilterApplyBar } from '@/components/search/FilterApplyBar'
import { FilterGroups } from '@/components/search/FilterGroups'
import { Badge } from '@/components/ui/badge'
import type { SearchTab, StagedFilters } from '@/lib/api/search-service'

type FilterSidebarMobileProps = {
  baseId: string
  tab: SearchTab
  draft: StagedFilters
  onDraftChange: (updater: (current: StagedFilters) => StagedFilters) => void
  wilayaField?: ReactNode
  savedSearchesSlot?: ReactNode
  badgeCount: number
  busy: boolean
  rateLimited: boolean
  rateLimitMessage?: string
  onClearAllRequest?: () => void
  // The gated runner shared with the desktop aside; this surface supplies
  // the panel-close side effect.
  runApply: (closePanel?: () => void) => void
}

export function FilterSidebarMobile({
  baseId,
  tab,
  draft,
  onDraftChange,
  wilayaField,
  savedSearchesSlot,
  badgeCount,
  busy,
  rateLimited,
  rateLimitMessage,
  onClearAllRequest,
  runApply,
}: FilterSidebarMobileProps) {
  const t = useTranslations()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const idPrefix = `${baseId}-mobile`

  const handleApply = () => {
    runApply(() => setFiltersOpen(false))
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={filtersOpen}
        aria-controls={`${baseId}-mobile-panel`}
        onClick={() => setFiltersOpen((open) => !open)}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 text-small font-medium md:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontalIcon className="size-4" />
          <span>{t('search.filters.title')}</span>
        </span>
        <span className="flex items-center gap-2">
          <Badge variant="default" className="rounded-full">
            {badgeCount}
          </Badge>
          {filtersOpen ? (
            <ChevronUpIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          )}
        </span>
      </button>
      <span className="sr-only" role="status">
        {t('search.filters.badge', { count: String(badgeCount) })}
      </span>
      {filtersOpen && (
        <section
          id={`${baseId}-mobile-panel`}
          aria-label={t('search.filters.title')}
          data-testid="mobile-filter-panel"
          className="mt-2 overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-title text-foreground">{t('search.filters.title')}</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClearAllRequest}
                className="min-h-11 cursor-pointer rounded-md px-2 text-caption text-primary hover:text-primary-hover"
              >
                {t('search.filters.clear')}
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label={t('common.actions.close')}
                className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon />
              </button>
            </div>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto px-4 py-4">
            <FilterGroups
              tab={tab}
              draft={draft}
              onDraftChange={onDraftChange}
              wilayaField={wilayaField}
              idPrefix={idPrefix}
            />
            {savedSearchesSlot}
          </div>
          <div className="border-t border-border">
            <FilterApplyBar
              busy={busy}
              rateLimited={rateLimited}
              rateLimitMessage={rateLimitMessage}
              idPrefix={idPrefix}
              onApply={handleApply}
            />
          </div>
        </section>
      )}
    </div>
  )
}
