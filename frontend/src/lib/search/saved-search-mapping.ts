import {
  filtersPayloadToStaged,
  type SearchTab,
  type StagedFilters,
} from '@/lib/api/search-service'
import {
  savedTypeToTab,
  tabToSavedType,
  type SavedSearchRow,
  type SavedSearchSnapshot,
  type SavedSearchSort,
} from '@/lib/api/saved-search-service'
import { SORT_FIELDS, type SortState } from '@/lib/search/search-params'
import type { SearchSubmitted } from '@/hooks/useSearchResults'

type SavedSearchRerun = {
  staged: StagedFilters
  nextSort: SortState | null
}

// A saved-search row → the committed (staged filters, sort) pair the URL
// push needs. Unknown sort fields/dirs degrade to the default (null) sort.
export function savedSearchRerun(row: SavedSearchRow): SavedSearchRerun {
  const rowTab: SearchTab = savedTypeToTab(row.type)
  const staged = filtersPayloadToStaged(row.filters, rowTab)
  const sortField = SORT_FIELDS.includes(row.sort?.field as (typeof SORT_FIELDS)[number])
    ? (row.sort?.field as (typeof SORT_FIELDS)[number])
    : null
  const sortDir = row.sort?.dir
  const nextSort: SortState | null =
    sortField !== null && (sortDir === 'asc' || sortDir === 'desc')
      ? { field: sortField, dir: sortDir }
      : null
  return { staged, nextSort }
}

// The snapshot is the search that was actually executed (the submitted
// payload + sort param), never a mix of staged state — a save captures
// exactly what produced the visible results (D6).
export function activeSearchSnapshot(
  submitted: SearchSubmitted,
  tab: SearchTab,
): SavedSearchSnapshot | null {
  let filters: Record<string, unknown>
  try {
    filters = JSON.parse(submitted.filtersJson) as Record<string, unknown>
  } catch {
    return null
  }
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
}
