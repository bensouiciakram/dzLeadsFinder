'use client'

import { useTranslations } from 'next-intl'

import { ActiveFilterChips, type ChipsFacet } from '@/components/search/ActiveFilterChips'
import { ExportToolbar } from '@/components/search/ExportToolbar'
import {
  ResultsTable,
} from '@/components/search/ResultsTable'
import type { SortState } from '@/lib/search/search-params'
import { ResultsTableStackedRow } from '@/components/search/ResultsTableStackedRow'
import { SearchResultsSkeleton } from '@/components/search/SearchResultsSkeleton'
import { SearchResultsStatus } from '@/components/search/SearchResultsStatus'
import { PaginationNav } from '@/components/ui/PaginationNav'
import { Button } from '@/components/ui/button'
import type { SearchPhase, SearchResultData, SearchSubmitted } from '@/hooks/useSearchResults'
import {
  SEARCH_PAGE_SIZE,
  type CompanyResultRow,
  type PeopleResultRow,
  type SearchTab,
} from '@/lib/api/search-service'
import { totalPages } from '@/lib/search/pagination'

type SearchResultsAreaProps = {
  tab: SearchTab
  phase: SearchPhase
  rateLimitMessage: string | undefined
  data: SearchResultData | undefined
  isFetching: boolean
  announcement: string | null
  submitted: SearchSubmitted
  nonce: number
  tier: 'free' | 'starter'
  sort: SortState | null
  onSortChange: (sort: SortState) => void
  onRetry: () => void
  onPage: (page: number) => void
  onClearAll: () => void
  onChipRemove: (facet: ChipsFacet, value: number | string | boolean) => void
}

export function SearchResultsArea({
  tab,
  phase,
  rateLimitMessage,
  data,
  isFetching,
  announcement,
  submitted,
  nonce,
  tier,
  sort,
  onSortChange,
  onRetry,
  onPage,
  onClearAll,
  onChipRemove,
}: SearchResultsAreaProps) {
  const t = useTranslations()
  const rows =
    tab === 'people'
      ? ((data?.results ?? []) as PeopleResultRow[])
      : ((data?.results ?? []) as CompanyResultRow[])
  const formatPageLabel = (current: number, total: number) =>
    t('search.results.pagination', { current: String(current), total: String(total) })

  return (
    <div aria-busy={phase === 'loading'} data-testid="results-area">
      <SearchResultsStatus
        phase={phase}
        rateLimitMessage={rateLimitMessage}
        total={data?.total}
        truncated={data?.truncated}
        announcement={announcement}
        onRetry={onRetry}
      />

      {phase === 'loading' && (
        <SearchResultsSkeleton tab={tab} sort={sort} onSortChange={onSortChange} />
      )}

      {phase === 'idle' && data !== undefined && data.total === 0 && (
        <div className="mt-4">
          <Button variant="outline" className="min-h-11 md:h-8" onClick={onClearAll}>
            {t('search.results.clear_all')}
          </Button>
        </div>
      )}

      {phase === 'idle' && data !== undefined && data.total > 0 && (
        <div className="mt-4">
          <ExportToolbar
            tab={tab}
            submitted={submitted}
            nonce={nonce}
            total={data.total}
            isFetching={isFetching}
            tier={tier}
          />
          <ActiveFilterChips filters={submitted.filters} onRemove={onChipRemove} />
          <div data-testid="results-slot" className="mt-4">
            <ResultsTable tab={tab} rows={rows} sort={sort} onSortChange={onSortChange} />
            <ResultsTableStackedRow tab={tab} rows={rows} />
          </div>
          {data.total > SEARCH_PAGE_SIZE && (
            <PaginationNav
              page={data.page}
              pageCount={totalPages(data.total)}
              onPage={onPage}
              formatLabel={formatPageLabel}
              ariaLabel={formatPageLabel(data.page, totalPages(data.total))}
            />
          )}
        </div>
      )}
    </div>
  )
}
