'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useReducer } from 'react'

import type { ChipsFacet } from '@/components/search/ActiveFilterChips'
import type { SortState } from '@/components/search/ResultsTable'
import type { SearchTab, StagedFilters } from '@/lib/api/search-service'
import { EMPTY_FILTERS } from '@/lib/api/search-service'
import {
  buildSearchUrl,
  buildSubmitted,
  parseSortParam,
  removeFacetValue,
} from '@/lib/search/search-params'

// The search form state (Phase 3 — M2/M4): the COMMITTED search (filters,
// sort, page) is derived from the URL (H3), and the user's in-progress
// DRAFT lives in a reducer. The controlled FilterSidebar reads `draft` and
// reports edits through `updateDraft` — the old command props (chipRemove,
// clearNonce, applied-sync effects) are gone (H4/M1).

type SearchFormState = {
  draft: StagedFilters
  dirty: boolean
}

type SearchFormAction =
  | { type: 'draft'; update: (current: StagedFilters) => StagedFilters }
  | { type: 'applied'; filters: StagedFilters }
  | { type: 'committed'; filters: StagedFilters }
  | { type: 'cleared' }

function reducer(state: SearchFormState, action: SearchFormAction): SearchFormState {
  switch (action.type) {
    case 'draft':
      return { draft: action.update(state.draft), dirty: true }
    case 'applied':
      return { draft: action.filters, dirty: false }
    // A committed search (URL change — e.g. back/forward) mirrors into the
    // draft only while the user hasn't edited: in-progress edits survive
    // navigation, exactly like the old lastAppliedRef semantics.
    case 'committed':
      return state.dirty ? state : { draft: action.filters, dirty: false }
    case 'cleared':
      return { draft: { ...EMPTY_FILTERS }, dirty: false }
  }
}

type UseSearchFormArgs = {
  tab: SearchTab
}

export function useSearchForm({ tab }: UseSearchFormArgs) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const submitted = useMemo(() => buildSubmitted(searchParams, tab), [searchParams, tab])
  const sort = useMemo(() => parseSortParam(submitted?.sort ?? null), [submitted])

  const [form, dispatch] = useReducer(reducer, {
    draft: submitted?.filters ?? { ...EMPTY_FILTERS },
    dirty: false,
  })

  useEffect(() => {
    dispatch({ type: 'committed', filters: submitted?.filters ?? { ...EMPTY_FILTERS } })
  }, [submitted, form.dirty])

  const commit = useCallback(
    (filters: StagedFilters, nextSort: SortState | null, page: number = 1) => {
      dispatch({ type: 'applied', filters })
      router.push(buildSearchUrl(pathname, filters, nextSort, page, tab))
    },
    [pathname, router, tab],
  )

  const updateDraft = useCallback((updater: (current: StagedFilters) => StagedFilters) => {
    dispatch({ type: 'draft', update: updater })
  }, [])

  const removeChip = useCallback((facet: ChipsFacet, value: number | string | boolean) => {
    dispatch({ type: 'draft', update: (current) => removeFacetValue(current, facet, value) })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'cleared' })
    router.push(pathname)
  }, [pathname, router])

  return { submitted, draft: form.draft, dirty: form.dirty, sort, commit, updateDraft, removeChip, clearAll }
}