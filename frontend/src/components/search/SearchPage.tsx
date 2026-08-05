'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { FilterSidebar } from '@/components/search/FilterSidebar'
import { Button } from '@/components/ui/button'
import {
  buildFiltersPayload,
  searchService,
  type SearchResult,
  type SearchTab,
  type StagedFilters,
} from '@/lib/api/search-service'

type Phase = 'idle' | 'loading' | 'error' | 'rate_limited'

type SearchError = {
  response?: {
    status?: number
    data?: { detail?: string }
  }
}

export type SearchPageProps = {
  tab: SearchTab
}

export function SearchPage({ tab }: SearchPageProps) {
  const t = useTranslations()
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [rateLimitMessage, setRateLimitMessage] = useState<string | undefined>(undefined)
  const [lastFilters, setLastFilters] = useState<StagedFilters | null>(null)

  const runSearch = async (filters: StagedFilters) => {
    if (phase === 'loading') return
    setPhase('loading')
    setLastFilters(filters)
    const payload = JSON.stringify(buildFiltersPayload(filters, tab))
    try {
      const data =
        tab === 'people'
          ? await searchService.searchPeople(payload)
          : await searchService.searchCompanies(payload)
      setResult(data)
      setPhase('idle')
    } catch (error) {
      const searchError = error as SearchError
      if (searchError.response?.status === 429) {
        setRateLimitMessage(searchError.response.data?.detail)
        setPhase('rate_limited')
      } else {
        setPhase('error')
      }
    }
  }

  const handleRetry = () => {
    if (lastFilters) void runSearch(lastFilters)
  }

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
        busy={phase === 'loading'}
        rateLimited={phase === 'rate_limited'}
        rateLimitMessage={rateLimitMessage}
        onSubmit={(filters) => void runSearch(filters)}
      />
      <main className="min-w-0 grow px-gutter py-6 md:px-gutter-desktop">
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

        <section id="results" aria-live="polite" className="mt-6">
          {phase === 'idle' && result === null && (
            <div className="rounded-lg border border-border bg-card p-6">
              <div data-testid="checklist-slot" />
              <p className="mt-4 text-small text-muted-foreground">{t('search.results.not_run')}</p>
            </div>
          )}
          {phase === 'loading' && <p className="text-small text-muted-foreground">{t('common.states.loading')}</p>}
          {phase === 'error' && (
            <div role="alert" className="rounded-lg border border-border bg-card p-6">
              <p className="text-small">{t('common.states.error')}</p>
              <Button variant="outline" className="mt-3" onClick={handleRetry}>
                {t('search.results.retry')}
              </Button>
            </div>
          )}
          {phase === 'rate_limited' && (
            <p className="text-small text-destructive">{rateLimitMessage ?? t('search.results.rate_limited')}</p>
          )}
          {result !== null && phase !== 'loading' && phase !== 'rate_limited' && (
            <div>
              {result.total > 0 ? (
                <p className="text-small text-muted-foreground tabular-nums">
                  {t('search.results.count', { count: result.total })}
                </p>
              ) : (
                <p className="text-small text-muted-foreground">{t('search.results.empty')}</p>
              )}
              {result.truncated && (
                <p className="mt-1 text-caption text-muted-foreground">{t('search.results.truncated')}</p>
              )}
              <div data-testid="results-slot" className="mt-4" />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
