'use client'

import { ResultsTable } from '@/components/search/ResultsTable'
import type { SortState } from '@/lib/search/search-params'
import { Skeleton } from '@/components/ui/skeleton'
import type { SearchTab } from '@/lib/api/search-service'

const SKELETON_CARDS = 3

type SearchResultsSkeletonProps = {
  tab: SearchTab
  sort: SortState | null
  onSortChange: (sort: SortState) => void
}

export function SearchResultsSkeleton({ tab, sort, onSortChange }: SearchResultsSkeletonProps) {
  return (
    <div className="mt-4">
      <ResultsTable tab={tab} rows={[]} sort={sort} onSortChange={onSortChange} skeleton />
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
  )
}
