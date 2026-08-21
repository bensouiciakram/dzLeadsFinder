'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { creditsService, type LedgerResult } from '@/lib/api/credits-service'
import type { LedgerRow } from '@/lib/api/credits-service'
import { creditsKeys } from '@/lib/queryKeys/credits'
import type { SessionUser } from '@/lib/api/auth-service'
import { userKey } from '@/lib/user-key'
import { queryPhase, type QueryPhase } from '@/lib/queryPhase'

type CreditsLedgerPhase = QueryPhase

type UseCreditsLedgerResult = {
  rows: LedgerRow[]
  total: number
  page: number
  truncated: boolean
  phase: CreditsLedgerPhase
  isFetching: boolean
  refetch: () => void
}

export function useCreditsLedger({
  user,
  page,
}: {
  user: SessionUser | null
  page: number
}): UseCreditsLedgerResult {
  const key = userKey(user)
  const query = useQuery({
    // The page is part of the key: navigating the ledger pages refetches,
    // never serves another page's rows (AD-21 key-factory discipline).
    queryKey: creditsKeys.ledger(key, page),
    queryFn: (): Promise<LedgerResult> => creditsService.ledger(page),
    enabled: user !== null,
  })

  const phase: CreditsLedgerPhase = queryPhase(user !== null, query)

  const refetch = useCallback(() => {
    void query.refetch()
  }, [query])

  const data = query.data
  return {
    rows: data?.results ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    truncated: data?.truncated ?? false,
    phase,
    isFetching: query.isFetching,
    refetch,
  }
}
