'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  billingService,
  type CancelResult,
  type HistoryResult,
  type PacksResult,
  type PlanResult,
} from '@/lib/api/billing-service'
import { billingKeys } from '@/lib/queryKeys/billing'
import {
  historyQueryOptions,
  packsQueryOptions,
  planQueryOptions,
} from '@/lib/queryOptions/billing'
import type { SessionUser } from '@/lib/api/auth-service'
import { userKey } from '@/lib/user-key'

export type BillingPhase = 'idle' | 'loading' | 'error' | 'success'

type UseBillingResult = {
  plan: PlanResult | null
  packs: PacksResult | null
  history: HistoryResult | null
  planPhase: BillingPhase
  packsPhase: BillingPhase
  historyPhase: BillingPhase
  cancel: {
    mutate: () => void
    isPending: boolean
    isError: boolean
    isSuccess: boolean
    error: unknown
  }
}

export function useBilling({ user }: { user: SessionUser | null }): UseBillingResult {
  const queryClient = useQueryClient()
  const key = userKey(user)

  // plan/packs/history derive from the shared factories (M8) — the /billing
  // page observes the SAME cache entries as the Header (usePlan) and the
  // RecoveryDialog (usePacks); a split derivation would split the FE cache.
  const planQuery = useQuery(planQueryOptions(user))

  const packsQuery = useQuery(packsQueryOptions(user, true))

  const historyQuery = useQuery(historyQueryOptions(user))

  const cancel = useMutation({
    mutationFn: (): Promise<CancelResult> => billingService.cancel(),
    // The Plan Card flips to "Cancelled — access until {date}" from
    // plan.status — invalidate the plan key only (no balance change on
    // cancel: no ledger rows, no cache writes — Winston Q9).
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: billingKeys.plan(key) }),
  })

  const phaseOf = (query: { isError: boolean; isPending: boolean }): BillingPhase =>
    user === null ? 'idle' : query.isError ? 'error' : query.isPending ? 'loading' : 'success'

  return {
    plan: planQuery.data ?? null,
    packs: packsQuery.data ?? null,
    history: historyQuery.data ?? null,
    planPhase: phaseOf(planQuery),
    packsPhase: phaseOf(packsQuery),
    historyPhase: phaseOf(historyQuery),
    cancel: {
      mutate: cancel.mutate,
      isPending: cancel.isPending,
      isError: cancel.isError,
      isSuccess: cancel.isSuccess,
      error: cancel.error,
    },
  }
}