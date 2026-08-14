'use client'

import { useQuery } from '@tanstack/react-query'

import { billingService, type PlanResult } from '@/lib/api/billing-service'
import { billingKeys } from '@/lib/queryKeys/billing'
import type { SessionUser } from '@/lib/api/auth-service'

type PlanPhase = 'idle' | 'loading' | 'error' | 'success'

type UsePlanResult = {
  plan: PlanResult | null
  phase: PlanPhase
}

// The header islands' plan-status source (5.7 — the SubscriptionChip +
// failed-renewal banner read plan.status on EVERY authenticated surface).
//
// Deliberate AD-21 overrides (documented rationale):
// - refetchOnWindowFocus: TRUE — the global default is false (a QUOTA
//   contract for search; a retried/window-focused success would re-burn
//   the FR-7 daily count). The plan GET is read-only and non-quota, and
//   the failed-renewal banner "persists until payment succeeds" — a paid
//   user returning to the tab must not keep seeing a stale banner. The
//   5.6 StatusCard invalidates the key only on /billing; here the focus
//   refetch is the prompt-clear mechanism.
// - NO refetchInterval — polling is the StatusCard's job (AD-5 ≤60s).
//
// The userKey derivation MUST stay identical to the 5.5 useBilling
// (user?.email ?? 'guest') — the Header, the banner and /billing all
// observe ONE shared billingKeys.plan cache entry (a mismatch would split
// the FE cache).
export function usePlan({ user }: { user: SessionUser | null }): UsePlanResult {
  const userKey = user?.email ?? 'guest'

  const query = useQuery({
    queryKey: billingKeys.plan(userKey),
    queryFn: (): Promise<PlanResult> => billingService.plan(),
    enabled: user !== null,
    refetchOnWindowFocus: true,
  })

  const phase: PlanPhase =
    user === null ? 'idle' : query.isError ? 'error' : query.isPending ? 'loading' : 'success'

  return { plan: query.data ?? null, phase }
}
