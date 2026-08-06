'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { savedSearchService, type SavedSearchRow } from '@/lib/api/saved-search-service'
import { savedSearchesKeys } from '@/lib/queryKeys/savedSearches'
import type { SessionUser } from '@/lib/api/auth-service'

export type SavedSearchesPhase = 'idle' | 'loading' | 'error' | 'success'

export type UseSavedSearchesResult = {
  savedSearches: SavedSearchRow[]
  phase: SavedSearchesPhase
  isFetching: boolean
  refetch: () => void
}

export function useSavedSearches({ user }: { user: SessionUser | null }): UseSavedSearchesResult {
  const query = useQuery({
    queryKey: savedSearchesKeys.list,
    queryFn: async (): Promise<SavedSearchRow[]> => savedSearchService.list(),
    enabled: user !== null,
    // Saved searches change only via the user's own mutations, and every
    // mutation invalidates the list key — a 60s staleTime only serves
    // same-session remounts (aside + drawer share the cache). Cross-device
    // freshness is out of scope for V1 (AD-21 cache-tuning rationale).
    staleTime: 60_000,
  })

  const phase: SavedSearchesPhase =
    user === null ? 'idle' : query.isError ? 'error' : query.isPending ? 'loading' : 'success'

  const refetch = useCallback(() => {
    void query.refetch()
  }, [query])

  return {
    savedSearches: query.data ?? [],
    phase,
    isFetching: query.isFetching,
    refetch,
  }
}
