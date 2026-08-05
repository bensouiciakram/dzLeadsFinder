'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { ActiveFilterChips } from '@/components/search/ActiveFilterChips'
import { FilterSidebar } from '@/components/search/FilterSidebar'
import {
  ResultsTable,
  columnLabelKey,
  type SortState,
} from '@/components/search/ResultsTable'
import { ResultsTableStackedRow } from '@/components/search/ResultsTableStackedRow'
import { WilayaCombobox } from '@/components/search/WilayaCombobox'
import { Button } from '@/components/ui/button'
import {
  buildFiltersPayload,
  searchService,
  type CompanyResultRow,
  type PeopleResultRow,
  type SearchTab,
  type StagedFilters,
} from '@/lib/api/search-service'

const PAGE_SIZE = 100

type Phase = 'idle' | 'loading' | 'error' | 'rate_limited'

type SearchError = {
  response?: {
    status?: number
    data?: { detail?: string }
  }
}

type Submitted = {
  filters: StagedFilters
  filtersJson: string
  page: number
  sort: string
}

function sortParamFor(sort: SortState | null): string {
  return sort !== null && sort.dir !== null ? `${sort.field}:${sort.dir}` : 'name:asc'
}

export type SearchPageProps = {
  tab: SearchTab
}

export function SearchPage({ tab }: SearchPageProps) {
  const t = useTranslations()
  const [submitted, setSubmitted] = useState<Submitted | null>(null)
  const [submitNonce, setSubmitNonce] = useState(0)
  const [applied, setApplied] = useState<StagedFilters | null>(null)
  const [sort, setSort] = useState<SortState | null>(null)
  const [rateLimitMessage, setRateLimitMessage] = useState<string | undefined>(undefined)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [wilayas, setWilayas] = useState<number[]>([])
  const [wilayaQuery, setWilayaQuery] = useState('')
  const [stagedPatch, setStagedPatch] = useState<Partial<StagedFilters> | null>(null)
  const [clearNonce, setClearNonce] = useState(0)

  const query = useQuery({
    queryKey:
      submitted === null
        ? ['search', 'idle']
        : ['search', tab, submitted.filtersJson, submitted.page, submitted.sort, submitNonce],
    queryFn: async ({ signal }) => {
      if (submitted === null) throw new Error('no search submitted')
      return tab === 'people'
        ? searchService.searchPeople(submitted.filtersJson, submitted.page, submitted.sort, signal)
        : searchService.searchCompanies(
            submitted.filtersJson,
            submitted.page,
            submitted.sort,
            signal,
          )
    },
    enabled: submitted !== null,
  })

  const rateLimited =
    query.isError &&
    (query.error as SearchError | null)?.response?.status === 429

  const phase: Phase = query.isError
    ? rateLimited
      ? 'rate_limited'
      : 'error'
    : submitted !== null && query.isPending
      ? 'loading'
      : 'idle'

  useEffect(() => {
    if (!query.isError) return
    const error = query.error as SearchError | null
    if (error?.response?.status === 429) {
      setRateLimitMessage(error.response.data?.detail)
    }
  }, [query.isError, query.error])

  useEffect(() => {
    if (query.isSuccess && submitted !== null) {
      setApplied(submitted.filters)
    }
  }, [query.isSuccess, submitted])

  const runSearch = (filters: StagedFilters) => {
    setRateLimitMessage(undefined)
    setStagedPatch(null)
    setAnnouncement(null)
    setSubmitNonce((nonce) => nonce + 1)
    setSubmitted({
      filters,
      filtersJson: JSON.stringify(buildFiltersPayload(filters, tab)),
      page: 1,
      sort: sortParamFor(sort),
    })
  }

  const handleSortChange = (next: SortState) => {
    if (submitted === null) return
    setSort(next)
    const announcementKey =
      next.dir === null
        ? 'search.results.sort_default'
        : next.dir === 'asc'
          ? 'search.results.sort_asc'
          : 'search.results.sort_desc'
    setAnnouncement(t(announcementKey, { column: t(columnLabelKey(next.field)) }))
    setSubmitNonce((nonce) => nonce + 1)
    setSubmitted((current) =>
      current === null ? null : { ...current, page: 1, sort: sortParamFor(next) },
    )
  }

  const handlePage = (next: number) => {
    if (submitted === null || query.data === undefined) return
    setAnnouncement(
      t('search.results.pagination', {
        current: String(next),
        total: String(totalPages(query.data.total)),
      }),
    )
    setSubmitNonce((nonce) => nonce + 1)
    setSubmitted((current) => (current === null ? null : { ...current, page: next }))
  }

  const handleRetry = () => {
    void query.refetch()
  }

  const handleClearAll = () => {
    setClearNonce((nonce) => nonce + 1)
    setWilayas([])
    setWilayaQuery('')
    setStagedPatch(null)
    setApplied(null)
    setSubmitted(null)
    setAnnouncement(null)
    setRateLimitMessage(undefined)
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
        stagedPatch={stagedPatch ?? undefined}
        clearNonce={clearNonce}
        onClearAllRequest={handleClearAll}
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
          {submitted === null && (
            <div className="rounded-lg border border-border bg-card p-6">
              <div data-testid="checklist-slot" />
              <p className="mt-4 text-small text-muted-foreground">{t('search.results.not_run')}</p>
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
                    <ActiveFilterChips filters={applied} onPatch={setStagedPatch} />
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
  return Math.max(1, Math.ceil(total / PAGE_SIZE))
}
