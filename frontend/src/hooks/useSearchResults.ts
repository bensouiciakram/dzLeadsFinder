'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import {
  isRateLimitError,
  searchService,
  type CompanyResultRow,
  type PeopleResultRow,
  type SearchResult,
  type SearchTab,
  type StagedFilters,
} from '@/lib/api/search-service'
import { searchKeys } from '@/lib/queryKeys/search'

type SearchPhase = 'idle' | 'loading' | 'error' | 'rate_limited'

export type SearchSubmitted = {
  filters: StagedFilters
  filtersJson: string
  page: number
  sort: string
}

type SearchResultData = SearchResult<PeopleResultRow> | SearchResult<CompanyResultRow>

type UseSearchResultsArgs = {
  tab: SearchTab
  submitted: SearchSubmitted | null
  onSuccess: (filters: StagedFilters) => void
}

export function useSearchResults({ tab, submitted, onSuccess }: UseSearchResultsArgs) {
  const queryClient = useQueryClient()
  const [submitNonce, setSubmitNonce] = useState(0)
  const [rateLimitMessage, setRateLimitMessage] = useState<string | undefined>(undefined)

  const query = useQuery({
    queryKey:
      submitted === null
        ? searchKeys.idle
        : searchKeys.results(
            tab,
            submitted.filtersJson,
            submitted.page,
            submitted.sort,
            submitNonce,
          ),
    queryFn: async ({ signal }): Promise<SearchResultData> => {
      if (submitted === null) throw new Error('no search submitted')
      return tab === 'people'
        ? searchService.searchPeople(
            submitted.filtersJson,
            submitted.page,
            submitted.sort,
            signal,
          )
        : searchService.searchCompanies(
            submitted.filtersJson,
            submitted.page,
            submitted.sort,
            signal,
          )
    },
    enabled: submitted !== null,
  })

  const rateLimited = query.isError && isRateLimitError(query.error)

  const phase: SearchPhase = query.isError
    ? rateLimited
      ? 'rate_limited'
      : 'error'
    : submitted !== null && query.isPending
      ? 'loading'
      : 'idle'

  useEffect(() => {
    if (!query.isError) return
    if (isRateLimitError(query.error)) {
      setRateLimitMessage(query.error.response.data?.detail)
    }
  }, [query.isError, query.error])

  useEffect(() => {
    if (query.isSuccess && submitted !== null) {
      onSuccess(submitted.filters)
    }
  }, [query.isSuccess, submitted, onSuccess])

  const beginSearch = () => {
    void queryClient.cancelQueries({ queryKey: searchKeys.tab(tab) })
    setRateLimitMessage(undefined)
    setSubmitNonce((nonce) => nonce + 1)
  }

  return { query, phase, rateLimited, rateLimitMessage, beginSearch, nonce: submitNonce }
}
