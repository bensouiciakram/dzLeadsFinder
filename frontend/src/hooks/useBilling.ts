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
import type { SessionUser } from '@/lib/api/auth-service'

export type BillingPhase = 'idle' | 'loading' | 'error' | 'success'

export type UseBillingResult = {
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
  const userKey = user?.email ?? 'guest'

  const planQuery = useQuery({
    queryKey: billingKeys.plan(userKey),
    queryFn: (): Promise<PlanResult> => billingService.plan(),
    enabled: user !== null,
  })

  const packsQuery = useQuery({
    queryKey: billingKeys.packs(userKey),
    queryFn: (): Promise<PacksResult> => billingService.packs(),
    enabled: user !== null,
  })

  const historyQuery = useQuery({
    queryKey: billingKeys.history(userKey),
    queryFn: (): Promise<HistoryResult> => billingService.history(),
    enabled: user !== null,
  })

  const cancel = useMutation({
    mutationFn: (): Promise<CancelResult> => billingService.cancel(),
    // The Plan Card flips to "Cancelled — access until {date}" from
    // plan.status — invalidate the plan key only (no balance change on
    // cancel: no ledger rows, no cache writes — Winston Q9).
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: billingKeys.plan(userKey) }),
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
