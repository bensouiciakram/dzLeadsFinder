'use client'

import { useQuery } from '@tanstack/react-query'

import { billingService, type PacksResult } from '@/lib/api/billing-service'
import { billingKeys } from '@/lib/queryKeys/billing'
import type { SessionUser } from '@/lib/api/auth-service'

export type PacksPhase = 'idle' | 'loading' | 'error' | 'success'

export type UsePacksResult = {
  packs: PacksResult | null
  phase: PacksPhase
}

// The RecoveryDialog's pack-table source (5.7 Task 6) — shares the
// billingKeys.packs cache entry with the /billing page (the 5.5 useBilling
// derivation; the same no-split-brain discipline as usePlan). The pack
// table is static server data.
//
// Review P6 (5.7 full review): the query is gated on the dialog being
// OPEN — the provider body mounts on every authenticated page, and an
// ungated query would fire GET /billing/packs/ on every page load even
// for users who never open the recovery dialog. The open-gate also makes
// the query refetch on each open, so a transient failure self-recovers on
// the next open (Edge LOW-9).
export function usePacks({
  user,
  isOpen,
}: {
  user: SessionUser | null
  isOpen: boolean
}): UsePacksResult {
  const userKey = user?.email ?? 'guest'

  const query = useQuery({
    queryKey: billingKeys.packs(userKey),
    queryFn: (): Promise<PacksResult> => billingService.packs(),
    enabled: user !== null && isOpen,
  })

  const phase: PacksPhase =
    user === null || !isOpen
      ? 'idle'
      : query.isError
        ? 'error'
        : query.isPending
          ? 'loading'
          : 'success'

  return { packs: query.data ?? null, phase }
}
