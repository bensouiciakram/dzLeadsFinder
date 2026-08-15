'use client'

import { useQuery } from '@tanstack/react-query'

import type { PacksResult } from '@/lib/api/billing-service'
import { packsQueryOptions } from '@/lib/queryOptions/billing'
import type { SessionUser } from '@/lib/api/auth-service'

type PacksPhase = 'idle' | 'loading' | 'error' | 'success'

type UsePacksResult = {
  packs: PacksResult | null
  phase: PacksPhase
}

// The RecoveryDialog's pack-table source (5.7 Task 6) — shares the
// billingKeys.packs cache entry with the /billing page (the same
// no-split-brain discipline as usePlan, now via the shared factory — M8).
// The pack table is static server data.
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
  const query = useQuery(packsQueryOptions(user, isOpen))

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