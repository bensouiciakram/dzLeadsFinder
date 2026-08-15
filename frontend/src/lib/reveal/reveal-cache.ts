// The reveal cache orchestration as PURE transforms (H5): the mutation's
// cache write-throughs were embedded in useReveal; the search-row flip is
// extracted here so it is unit-testable without a query client.

export type RevealVariables = {
  type: 'people' | 'company'
  id: string
}

export type RevealInFlight = (RevealVariables & { userKey: string }) | null

type SearchCacheRow = {
  id: string
  revealed: boolean
}

export function isSearchCache(value: unknown): value is { results: SearchCacheRow[] } {
  if (typeof value !== 'object' || value === null) return false
  const data = value as { results?: unknown }
  return Array.isArray(data.results)
}

// The setQueriesData updater for searchKeys.all: flips the revealed flag on
// the matching row, preserves every other cache entry untouched (including
// non-search caches — the guard returns them as-is).
export function updateSearchResultsWithReveal(old: unknown, id: string): unknown {
  if (!isSearchCache(old)) return old
  return {
    ...old,
    results: old.results.map((row) => (row.id === id ? { ...row, revealed: true } : row)),
  }
}