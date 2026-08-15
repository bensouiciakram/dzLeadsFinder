import {
  billingService,
  type HistoryResult,
  type PacksResult,
  type PlanResult,
} from '@/lib/api/billing-service'
import { billingKeys } from '@/lib/queryKeys/billing'
import type { SessionUser } from '@/lib/api/auth-service'
import { userKey } from '@/lib/user-key'

// The billing query options as shared factories (M8): useBilling previously
// redefined the plan/packs queries that usePlan/usePacks already owned —
// three definitions of one queryKey. Every consumer now derives from ONE
// factory, so the key derivation (userKey) and the enabled gate can never
// drift apart. Overrides (e.g. usePlan's refetchOnWindowFocus) are applied
// by the caller on top of the spread.

export function planQueryOptions(user: SessionUser | null) {
  return {
    queryKey: billingKeys.plan(userKey(user)),
    queryFn: (): Promise<PlanResult> => billingService.plan(),
    enabled: user !== null,
  }
}

export function packsQueryOptions(user: SessionUser | null, enabled: boolean) {
  return {
    queryKey: billingKeys.packs(userKey(user)),
    queryFn: (): Promise<PacksResult> => billingService.packs(),
    enabled: user !== null && enabled,
  }
}

export function historyQueryOptions(user: SessionUser | null) {
  return {
    queryKey: billingKeys.history(userKey(user)),
    queryFn: (): Promise<HistoryResult> => billingService.history(),
    enabled: user !== null,
  }
}