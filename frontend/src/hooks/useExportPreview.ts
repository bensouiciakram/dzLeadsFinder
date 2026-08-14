'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import {
  searchService,
  SEARCH_MAX_NAVIGABLE_PAGES,
  SEARCH_PAGE_SIZE,
  type CompanyResultRow,
  type PeopleResultRow,
  type SearchResult,
  type SearchTab,
} from '@/lib/api/search-service'
import { searchKeys } from '@/lib/queryKeys/search'

const PAGE_SIZE = SEARCH_PAGE_SIZE
const MAX_PAGES = SEARCH_MAX_NAVIGABLE_PAGES

type ExportPreviewRow = {
  id: string
  name: string
  role: string | null
  company_name: string | null
  industry: string | null
  wilaya_name: string | null
  wilaya_code: number | null
  people_count: number
  revealed: boolean
}

export type ExportPreview = {
  ids: string[]
  rows: ExportPreviewRow[]
  revealedCount: number
  unrevealedCount: number
  totalRows: number
}

type UseExportPreviewArgs = {
  open: boolean
  tab: SearchTab
  filtersJson: string
  sort: string
  nonce: number
  total: number
  tier: 'free' | 'starter'
}

type SearchPageData = SearchResult<PeopleResultRow> | SearchResult<CompanyResultRow>

function normalize(row: PeopleResultRow | CompanyResultRow): ExportPreviewRow {
  if ('company_id' in row) {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      company_name: row.company_name,
      industry: null,
      wilaya_name: row.wilaya_name,
      wilaya_code: row.wilaya_code,
      people_count: 0,
      revealed: row.revealed,
    }
  }
  return {
    id: row.id,
    name: row.name,
    role: null,
    company_name: null,
    industry: row.industry,
    wilaya_name: row.wilaya_name,
    wilaya_code: row.wilaya_code,
    people_count: row.people_count,
    revealed: row.revealed,
  }
}

async function collectPreview(
  queryClient: ReturnType<typeof useQueryClient>,
  args: Omit<UseExportPreviewArgs, 'open'>,
  signal: AbortSignal,
): Promise<ExportPreview> {
  const { tab, filtersJson, sort, nonce, total, tier } = args
  const pageCount =
    tier === 'free' ? 1 : Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES)
  const ids: string[] = []
  const seen = new Set<string>()
  const rows: ExportPreviewRow[] = []
  let revealed = 0

  for (let page = 1; page <= pageCount; page += 1) {
    const cached = queryClient.getQueryData<SearchPageData>(
      searchKeys.results(tab, filtersJson, page, sort, nonce),
    )
    const data =
      cached ??
      (tab === 'people'
        ? await searchService.searchPeople(filtersJson, page, sort, signal)
        : await searchService.searchCompanies(filtersJson, page, sort, signal))
    for (const row of data.results) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      ids.push(row.id)
      rows.push(normalize(row))
      if (row.revealed) revealed += 1
    }
  }

  // The server total is the truthful bound: pages cached before a server-side
  // shrink can hold more rows than the current result set (review patch L10).
  let collected = rows.length
  if (total > 0 && total <= PAGE_SIZE * MAX_PAGES && collected > total) {
    collected = total
  }
  const cap = tier === 'free' ? Math.min(5, collected) : collected
  const included = rows.slice(0, cap)
  const includedRevealed = included.filter((row) => row.revealed).length
  return {
    ids: ids.slice(0, cap),
    rows: included,
    revealedCount: includedRevealed,
    unrevealedCount: cap - includedRevealed,
    totalRows: cap,
  }
}

export function useExportPreview(args: UseExportPreviewArgs) {
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [isCollecting, setIsCollecting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  const { open, tab, filtersJson, sort, nonce, total, tier } = args

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const controller = new AbortController()
    // The previous collection's preview is stale the moment the inputs change
    // (re-open after a filter change): the modal must never confirm the OLD
    // result set while the new one is being collected (review patch H-A1).
    setPreview(null)
    setIsCollecting(true)
    setError(null)

    void (async () => {
      try {
        const result = await collectPreview(
          queryClient,
          { tab, filtersJson, sort, nonce, total, tier },
          controller.signal,
        )
        if (!cancelled) {
          setPreview(result)
          setIsCollecting(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err)
          setPreview(null)
          setIsCollecting(false)
        }
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, tab, filtersJson, sort, nonce, total, tier, attempt, queryClient])

  const retry = useCallback(() => {
    setAttempt((value) => value + 1)
  }, [])

  return { preview, isCollecting, error, retry }
}
