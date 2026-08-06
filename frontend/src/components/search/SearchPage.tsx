'use client'

import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ActiveFilterChips, type ChipsFacet } from '@/components/search/ActiveFilterChips'
import { ChecklistCard } from '@/components/search/ChecklistCard'
import { FilterSidebar, type ChipRemoveEvent } from '@/components/search/FilterSidebar'
import {
  ResultsTable,
  columnLabelKey,
  type SortField,
  type SortState,
} from '@/components/search/ResultsTable'
import { ResultsTableStackedRow } from '@/components/search/ResultsTableStackedRow'
import {
  SavedSearchesList,
  type SavedSearchSnapshot,
} from '@/components/search/SavedSearchesList'
import { WilayaCombobox } from '@/components/search/WilayaCombobox'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSearchResults, type SearchSubmitted } from '@/hooks/useSearchResults'
import {
  buildFiltersPayload,
  filtersPayloadToStaged,
  type CompanyResultRow,
  type PeopleResultRow,
  type SearchTab,
  type StagedFilters,
} from '@/lib/api/search-service'
import type { SavedSearchRow, SavedSearchSort, SavedSearchType } from '@/lib/api/saved-search-service'
import { savedTypeToTab, tabToSavedType } from '@/lib/api/saved-search-service'
import type { ChecklistStep } from '@/lib/api/checklist-service'
import { checklistKeys } from '@/lib/queryKeys/checklist'

const PAGE_SIZE = 100
const MAX_NAVIGABLE_PAGES = 10
const SKELETON_CARDS = 3

const SORT_FIELDS: readonly SortField[] = [
  'name',
  'role',
  'company_name',
  'wilaya_code',
  'industry',
  'size_band',
  'people_count',
]

function sortParamFor(sort: SortState | null): string {
  return sort !== null && sort.dir !== null ? `${sort.field}:${sort.dir}` : 'name:asc'
}

export type SearchPageProps = {
  tab: SearchTab
}

export function SearchPage({ tab }: SearchPageProps) {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const [submitted, setSubmitted] = useState<SearchSubmitted | null>(null)
  const [applied, setApplied] = useState<StagedFilters | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [wilayas, setWilayas] = useState<number[]>([])
  const [wilayaQuery, setWilayaQuery] = useState('')
  const [chipRemove, setChipRemove] = useState<ChipRemoveEvent | null>(null)
  const [clearNonce, setClearNonce] = useState(0)
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const savedTargetRef = useRef<string | null>(null)

  const onSuccess = useCallback((filters: StagedFilters) => {
    setApplied(filters)
    // The active indicator tracks the LAST RE-RUN only: a success without a
    // pending target clears the highlight (the results no longer match the
    // row — e.g. after a manual Apply or sort change); a failed re-run
    // clears the target via the error effect, so a later unrelated success
    // can never mark the wrong row.
    setActiveSavedId(savedTargetRef.current)
    savedTargetRef.current = null
  }, [])

  const { query, phase, rateLimitMessage, beginSearch } = useSearchResults({
    tab,
    submitted,
    onSuccess,
  })

  useEffect(() => {
    if (query.isError) savedTargetRef.current = null
  }, [query.isError])

  const activeSearch: SavedSearchSnapshot | null = useMemo(() => {
    if (submitted === null) return null
    let filters: Record<string, unknown>
    try {
      filters = JSON.parse(submitted.filtersJson) as Record<string, unknown>
    } catch {
      return null
    }
    // The snapshot is the search that was actually executed (the submitted
    // payload + sort param), never a mix of staged state — a save captures
    // exactly what produced the visible results (D6).
    const [field, dir] = submitted.sort.split(':')
    const sortState: SavedSearchSort | null =
      submitted.sort === 'name:asc'
        ? null
        : dir === 'asc' || dir === 'desc'
          ? { field, dir }
          : null
    return {
      type: tabToSavedType(tab),
      filters,
      sort: sortState,
    }
  }, [submitted, tab])

  useEffect(() => {
    if (query.isError) setAnnouncement(null)
  }, [query.isError])

  // A fresh successful search can be the FIRST search ever — the checklist
  // refetch (invalidation-triggered) flips step 1 server-side and the card's
  // step-flip effect fires the announcement (one cheap GET per success;
  // step_search stays true afterwards, so no repeated announcements).
  useEffect(() => {
    if (query.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: checklistKeys.all })
    }
  }, [query.isSuccess, queryClient])

  const handleChecklistStepComplete = (step: ChecklistStep) => {
    const announcementKey =
      step === 'search'
        ? 'search.checklist.done_search'
        : step === 'reveal'
          ? 'search.checklist.done_reveal'
          : 'search.checklist.done_export'
    setAnnouncement(t(announcementKey))
  }

  const startSearch = () => {
    beginSearch()
    setChipRemove(null)
    setAnnouncement(null)
  }

  const submitSearch = (filters: StagedFilters, sortState: SortState | null) => {
    startSearch()
    setSubmitted({
      filters,
      filtersJson: JSON.stringify(buildFiltersPayload(filters, tab)),
      page: 1,
      sort: sortParamFor(sortState),
    })
  }

  const runSearch = (filters: StagedFilters) => {
    submitSearch(filters, sort)
  }

  const handleRerun = (row: SavedSearchRow) => {
    const rowTab: SearchTab = savedTypeToTab(row.type)
    const staged = filtersPayloadToStaged(row.filters, rowTab)
    const sortField = SORT_FIELDS.includes(row.sort?.field as SortField)
      ? (row.sort?.field as SortField)
      : null
    const sortDir = row.sort?.dir
    const nextSort: SortState | null =
      sortField !== null && (sortDir === 'asc' || sortDir === 'desc')
        ? { field: sortField, dir: sortDir }
        : null
    savedTargetRef.current = row.id
    setWilayas(staged.wilayas)
    setWilayaQuery('')
    setSort(nextSort)
    submitSearch(staged, nextSort)
  }

  const handleSortChange = (next: SortState) => {
    if (submitted === null) return
    setSort(next)
    startSearch()
    const announcementKey =
      next.dir === null
        ? 'search.results.sort_default'
        : next.dir === 'asc'
          ? 'search.results.sort_asc'
          : 'search.results.sort_desc'
    const columnKey = next.dir === null ? columnLabelKey('name') : columnLabelKey(next.field)
    setAnnouncement(t(announcementKey, { column: t(columnKey) }))
    setSubmitted((current) =>
      current === null ? null : { ...current, page: 1, sort: sortParamFor(next) },
    )
  }

  const handlePage = (next: number) => {
    if (submitted === null || query.data === undefined) return
    startSearch()
    setAnnouncement(
      t('search.results.pagination', {
        current: String(next),
        total: String(totalPages(query.data.total)),
      }),
    )
    setSubmitted((current) => (current === null ? null : { ...current, page: next }))
  }

  const handleRetry = () => {
    void query.refetch()
  }

  const handleClearAll = () => {
    setClearNonce((nonce) => nonce + 1)
    setWilayas([])
    setWilayaQuery('')
    setChipRemove(null)
    setApplied(null)
    setSubmitted(null)
    setSort(null)
    setAnnouncement(null)
    setActiveSavedId(null)
    savedTargetRef.current = null
  }

  const handleChipRemove = (facet: ChipsFacet, value: number | string | boolean) => {
    setChipRemove({ facet, value })
    if (facet === 'wilayas' && typeof value === 'number') {
      setWilayas((current) => current.filter((code) => code !== value))
    }
  }

  const rows =
    tab === 'people'
      ? ((query.data?.results ?? []) as PeopleResultRow[])
      : ((query.data?.results ?? []) as CompanyResultRow[])

  return (
    <div className="mx-auto flex max-w-content-max-app">
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-50 focus:bg-card focus:px-4 focus:py-2 focus:text-small focus:text-primary"
      >
        {t('search.skip_to_results')}
      </a>
      <FilterSidebar
        tab={tab}
        applied={applied ?? undefined}
        busy={phase === 'loading'}
        rateLimited={phase === 'rate_limited'}
        rateLimitMessage={rateLimitMessage}
        wilayaField={
          <WilayaCombobox
            value={wilayas}
            onChange={setWilayas}
            inputValue={wilayaQuery}
            onInputValueChange={setWilayaQuery}
          />
        }
        wilayaCount={wilayas.length}
        chipRemove={chipRemove ?? undefined}
        clearNonce={clearNonce}
        onClearAllRequest={handleClearAll}
        savedSearchesSlot={
          <SavedSearchesList
            tab={tab}
            activeSearchId={activeSavedId}
            activeSearch={activeSearch}
            onRerun={handleRerun}
          />
        }
        onSubmit={(filters) => void runSearch({ ...filters, wilayas })}
      />
      <main className="min-w-0 grow px-gutter py-6 md:px-gutter-desktop">
        <h1 className="sr-only">{t('search.title')}</h1>
        <nav aria-label={t('common.nav.search')} className="flex gap-2">
          <Link
            href="/search"
            aria-current={tab === 'people' ? 'page' : undefined}
            className={
              tab === 'people'
                ? 'inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-small font-medium text-primary-foreground md:min-h-8'
                : 'inline-flex min-h-11 items-center rounded-md px-4 text-small font-medium text-muted-foreground hover:text-foreground md:min-h-8'
            }
          >
            {t('search.people_tab')}
          </Link>
          <Link
            href="/search/companies"
            aria-current={tab === 'companies' ? 'page' : undefined}
            className={
              tab === 'companies'
                ? 'inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-small font-medium text-primary-foreground md:min-h-8'
                : 'inline-flex min-h-11 items-center rounded-md px-4 text-small font-medium text-muted-foreground hover:text-foreground md:min-h-8'
            }
          >
            {t('search.companies_tab')}
          </Link>
        </nav>

        <section id="results" data-testid="results" className="mt-6">
          <ChecklistCard onStepComplete={handleChecklistStepComplete} />

          {submitted === null && (
            <div className="mt-4 rounded-lg border border-border bg-card p-6">
              <p className="text-small text-muted-foreground">{t('search.results.not_run')}</p>
            </div>
          )}

          {submitted !== null && (
            <div aria-busy={phase === 'loading'} data-testid="results-area">
              <div aria-live="polite" data-testid="results-status">
                {phase === 'loading' && (
                  <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>
                )}
                {phase === 'error' && (
                  <div role="alert" className="rounded-lg border border-border bg-card p-6">
                    <p className="text-small">{t('common.states.error')}</p>
                    <Button variant="outline" className="mt-3" onClick={handleRetry}>
                      {t('search.results.retry')}
                    </Button>
                  </div>
                )}
                {phase === 'rate_limited' && (
                  <p className="text-small text-destructive">
                    {rateLimitMessage ?? t('search.results.rate_limited')}
                  </p>
                )}
                {phase === 'idle' && query.data !== undefined && (
                  <>
                    <p className="text-small text-muted-foreground tabular-nums">
                      {query.data.total > 0
                        ? t('search.results.count', { count: String(query.data.total) })
                        : t('search.results.empty')}
                    </p>
                    {query.data.truncated && (
                      <p className="mt-1 text-caption text-muted-foreground">
                        {t('search.results.truncated')}
                      </p>
                    )}
                    {announcement !== null && (
                      <span className="sr-only" role="status">
                        {announcement}
                      </span>
                    )}
                  </>
                )}
              </div>

              {phase === 'loading' && (
                <div className="mt-4">
                  <ResultsTable tab={tab} rows={[]} sort={sort} onSortChange={handleSortChange} skeleton />
                  <div className="flex flex-col gap-3 md:hidden">
                    {Array.from({ length: SKELETON_CARDS }, (_, index) => (
                      <div
                        key={`skeleton-card-${index}`}
                        data-testid="skeleton-card"
                        aria-hidden="true"
                        className="rounded-lg border border-border bg-card p-gutter"
                      >
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="mt-2 h-4 w-full" />
                        <Skeleton className="mt-2 h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {phase === 'idle' && query.data !== undefined && query.data.total === 0 && (
                <div className="mt-4">
                  <Button variant="outline" className="min-h-11 md:h-8" onClick={handleClearAll}>
                    {t('search.results.clear_all')}
                  </Button>
                </div>
              )}

              {phase === 'idle' && query.data !== undefined && query.data.total > 0 && (
                <div className="mt-4">
                  {applied !== null && (
                    <ActiveFilterChips filters={applied} onRemove={handleChipRemove} />
                  )}
                  <div data-testid="results-slot" className="mt-4">
                    <ResultsTable tab={tab} rows={rows} sort={sort} onSortChange={handleSortChange} />
                    <ResultsTableStackedRow tab={tab} rows={rows} />
                  </div>
                  {query.data.total > PAGE_SIZE && (
                    <nav
                      aria-label={t('search.results.pagination', {
                        current: String(query.data.page),
                        total: String(totalPages(query.data.total)),
                      })}
                      className="mt-4 flex items-center justify-center gap-2"
                    >
                      <Button
                        variant="outline"
                        disabled={query.data.page <= 1}
                        onClick={() => handlePage(query.data.page - 1)}
                        className="min-h-11 md:h-8"
                      >
                        <ChevronLeftIcon className="size-4 rtl:rotate-180" />
                        {t('search.results.previous')}
                      </Button>
                      <span
                        aria-current="page"
                        className="text-small text-muted-foreground tabular-nums"
                      >
                        {t('search.results.pagination', {
                          current: String(query.data.page),
                          total: String(totalPages(query.data.total)),
                        })}
                      </span>
                      <Button
                        variant="outline"
                        disabled={query.data.page >= totalPages(query.data.total)}
                        onClick={() => handlePage(query.data.page + 1)}
                        className="min-h-11 md:h-8"
                      >
                        {t('common.actions.next')}
                        <ChevronRightIcon className="size-4 rtl:rotate-180" />
                      </Button>
                    </nav>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function totalPages(total: number): number {
  return Math.min(MAX_NAVIGABLE_PAGES, Math.max(1, Math.ceil(total / PAGE_SIZE)))
}
