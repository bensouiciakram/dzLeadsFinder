'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { ChecklistCard } from '@/components/search/ChecklistCard'
import { CreditsWelcomeBanner } from '@/components/search/CreditsWelcomeBanner'
import { FilterSidebar } from '@/components/search/FilterSidebar'
import { columnLabelKey } from '@/components/search/ResultsTable'
import type { SortState } from '@/lib/search/search-params'
import { useSession } from '@/components/providers/SessionProvider'
import { SavedSearchesList } from '@/components/search/SavedSearchesList'
import { SearchResultsArea } from '@/components/search/SearchResultsArea'
import { SearchTabNav } from '@/components/search/SearchTabNav'
import { WilayaCombobox } from '@/components/search/WilayaCombobox'
import type { ChipsFacet } from '@/components/search/ActiveFilterChips'
import { activeSearchSnapshot, savedSearchRerun } from '@/lib/search/saved-search-mapping'
import { totalPages } from '@/lib/search/pagination'
import { entitlementTierOf } from '@/lib/entitlement'
import { useChecklist } from '@/hooks/useChecklist'
import { useChecklistStepAnnouncement } from '@/hooks/useChecklistStepAnnouncement'
import { useSearchAnnouncements } from '@/hooks/useSearchAnnouncements'
import { useSearchForm } from '@/hooks/useSearchForm'
import { useSearchResults } from '@/hooks/useSearchResults'
import type { SearchTab, StagedFilters } from '@/lib/api/search-service'
import type { SavedSearchRow } from '@/lib/api/saved-search-service'
import type { ChecklistStep } from '@/lib/api/checklist-service'

type SearchPageProps = {
  tab: SearchTab
}

export function SearchPage({ tab }: SearchPageProps) {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const checklist = useChecklist({ user })
  const {
    submitted,
    draft,
    sort,
    commit,
    updateDraft,
    removeChip,
    clearAll,
  } = useSearchForm({ tab })
  const [wilayas, setWilayas] = useState<number[]>([])
  const [wilayaQuery, setWilayaQuery] = useState('')
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const savedTargetRef = useRef<string | null>(null)

  const onSuccess = (filters: StagedFilters) => {
    // The active indicator tracks the LAST RE-RUN only: a success without a
    // pending target clears the highlight (the results no longer match the
    // row — e.g. after a manual Apply or sort change); a failed re-run
    // clears the target via the error effect, so a later unrelated success
    // can never mark the wrong row.
    setActiveSavedId(savedTargetRef.current)
    savedTargetRef.current = null
  }

  const { query, phase, rateLimitMessage, beginSearch, nonce } = useSearchResults({
    tab,
    submitted,
    onSuccess,
  })

  const { announcement, announce, announceOnce, clear: clearAnnouncement } =
    useSearchAnnouncements({ isError: query.isError })
  useChecklistStepAnnouncement({
    state: checklist.state,
    searchSuccess: query.isSuccess,
    announce,
  })

  useEffect(() => {
    if (query.isError) savedTargetRef.current = null
  }, [query.isError])

  const activeSearch = useMemo(
    () => (submitted === null ? null : activeSearchSnapshot(submitted, tab)),
    [submitted, tab],
  )

  const handleChecklistStepComplete = (step: ChecklistStep) => {
    const announcementKey =
      step === 'search'
        ? 'search.checklist.done_search'
        : step === 'reveal'
          ? 'search.checklist.done_reveal'
          : 'search.checklist.done_export'
    announceOnce(t(announcementKey))
  }

  // Every user search action: cancel any in-flight query, bump the submit
  // nonce (fresh export-preview keys), clear the feedback announcement, and
  // let the URL push drive the committed state.
  const startSearch = () => {
    beginSearch()
    clearAnnouncement()
  }

  const handleApply = () => {
    startSearch()
    // The combobox's selection is deliberately lifted (the dual-combobox
    // sync contract) — merge it into the committed filters, exactly like
    // the old runSearch({ ...filters, wilayas }).
    commit({ ...draft, wilayas }, sort)
  }

  const handleRerun = (row: SavedSearchRow) => {
    const { staged, nextSort } = savedSearchRerun(row)
    savedTargetRef.current = row.id
    setWilayas(staged.wilayas)
    setWilayaQuery('')
    startSearch()
    commit(staged, nextSort)
  }

  const handleSortChange = (next: SortState) => {
    if (submitted === null) return
    startSearch()
    const announcementKey =
      next.dir === null
        ? 'search.results.sort_default'
        : next.dir === 'asc'
          ? 'search.results.sort_asc'
          : 'search.results.sort_desc'
    const columnKey = next.dir === null ? columnLabelKey('name') : columnLabelKey(next.field)
    announce(t(announcementKey, { column: t(columnKey) }))
    commit(submitted.filters, next)
  }

  const handlePage = (next: number) => {
    if (submitted === null || query.data === undefined) return
    startSearch()
    announce(
      t('search.results.pagination', {
        current: String(next),
        total: String(totalPages(query.data.total)),
      }),
    )
    commit(submitted.filters, sort, next)
  }

  const handleRetry = () => {
    void query.refetch()
  }

  const handleClearAll = () => {
    setWilayas([])
    setWilayaQuery('')
    clearAnnouncement()
    setActiveSavedId(null)
    savedTargetRef.current = null
    clearAll()
  }

  const handleChipRemove = (facet: ChipsFacet, value: number | string | boolean) => {
    removeChip(facet, value)
    if (facet === 'wilayas' && typeof value === 'number') {
      setWilayas((current) => current.filter((code) => code !== value))
    }
  }

  return (
    <div className="mx-auto flex max-w-content-max-app flex-col md:flex-row">
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:z-50 focus:bg-card focus:px-4 focus:py-2 focus:text-small focus:text-primary"
      >
        {t('search.skip_to_results')}
      </a>
      <FilterSidebar
        tab={tab}
        draft={draft}
        onDraftChange={updateDraft}
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
        onClearAllRequest={handleClearAll}
        savedSearchesSlot={
          <SavedSearchesList
            tab={tab}
            activeSearchId={activeSavedId}
            activeSearch={activeSearch}
            onRerun={handleRerun}
          />
        }
        onApply={handleApply}
        collapsed={!sidebarOpen}
        onCollapseRequest={() => setSidebarOpen(false)}
      />
      <main className="min-w-0 grow px-gutter py-6 md:px-gutter-desktop">
        <h1 className="sr-only">{t('search.title')}</h1>
        <SearchTabNav
          tab={tab}
          sidebarOpen={sidebarOpen}
          onReopenSidebar={() => setSidebarOpen(true)}
        />

        <section id="results" data-testid="results" className="mt-6">
          <CreditsWelcomeBanner />
          <ChecklistCard onStepComplete={handleChecklistStepComplete} />

          {submitted === null && (
            <div className="mt-4 rounded-lg border border-border bg-card p-6">
              <p className="text-small text-muted-foreground">{t('search.results.not_run')}</p>
            </div>
          )}

          {submitted !== null && (
            <SearchResultsArea
              tab={tab}
              phase={phase}
              rateLimitMessage={rateLimitMessage}
              data={query.data}
              isFetching={query.isFetching}
              announcement={announcement}
              submitted={submitted}
              nonce={nonce}
              tier={entitlementTierOf(user?.tier)}
              sort={sort}
              onSortChange={handleSortChange}
              onRetry={handleRetry}
              onPage={handlePage}
              onClearAll={handleClearAll}
              onChipRemove={handleChipRemove}
            />
          )}
        </section>
      </main>
    </div>
  )
}
