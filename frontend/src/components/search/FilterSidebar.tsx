'use client'

import { XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, type ReactNode } from 'react'

import { FilterApplyBar } from '@/components/search/FilterApplyBar'
import { FilterGroups } from '@/components/search/FilterGroups'
import { FilterSidebarMobile } from '@/components/search/FilterSidebarMobile'
import { useFilterApplyGate } from '@/hooks/useFilterApplyGate'
import {
  countActiveFilters,
  type SearchTab,
  type StagedFilters,
} from '@/lib/api/search-service'

// A controlled sidebar (Phase 3 — H4/M1): the draft lives in the parent
// (useSearchForm's reducer); the old command props (chipRemove, clearNonce,
// applied-sync effects) and the onSubmit copy were removed. Edits flow up
// through onDraftChange; Apply reports through onApply.
type FilterSidebarProps = {
  tab: SearchTab
  draft: StagedFilters
  onDraftChange: (updater: (current: StagedFilters) => StagedFilters) => void
  onApply: () => void
  onClearAllRequest?: () => void
  busy?: boolean
  rateLimited?: boolean
  rateLimitMessage?: string
  wilayaField?: ReactNode
  wilayaCount?: number
  savedSearchesSlot?: ReactNode
  collapsed?: boolean
  onCollapseRequest?: () => void
}

export function FilterSidebar({
  tab,
  draft,
  onDraftChange,
  onApply,
  onClearAllRequest,
  busy = false,
  rateLimited = false,
  rateLimitMessage,
  wilayaField,
  wilayaCount = 0,
  savedSearchesSlot,
  collapsed = false,
  onCollapseRequest,
}: FilterSidebarProps) {
  const t = useTranslations()
  const baseId = useId()
  const { runApply } = useFilterApplyGate({ busy, rateLimited, onApply })

  const badgeCount = countActiveFilters({ ...draft, wilayas: [] }) + wilayaCount

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
              onClick={onClearAllRequest}
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
          <FilterGroups
            tab={tab}
            draft={draft}
            onDraftChange={onDraftChange}
            wilayaField={wilayaField}
            idPrefix={`${baseId}-aside`}
          />
          {savedSearchesSlot}
        </div>
        <div className="border-t border-border">
          <div className="border-inline-end border-border">
            <FilterApplyBar
              busy={busy}
              rateLimited={rateLimited}
              rateLimitMessage={rateLimitMessage}
              idPrefix={`${baseId}-aside`}
              onApply={() => runApply()}
            />
          </div>
        </div>
      </aside>

      <FilterSidebarMobile
        baseId={baseId}
        tab={tab}
        draft={draft}
        onDraftChange={onDraftChange}
        wilayaField={wilayaField}
        savedSearchesSlot={savedSearchesSlot}
        badgeCount={badgeCount}
        busy={busy}
        rateLimited={rateLimited}
        rateLimitMessage={rateLimitMessage}
        onClearAllRequest={onClearAllRequest}
        runApply={runApply}
      />
    </>
  )
}
