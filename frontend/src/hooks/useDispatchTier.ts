'use client'

import { useSession } from '@/components/providers/SessionProvider'
import { usePlan } from '@/hooks/usePlan'
import { entitlementTierOf, type EntitlementTier } from '@/lib/entitlement'

// The dispatch tier (Review P5, 5.7 full review): the PLAN query's tier —
// fresh via the window-focus refetch — with the session tier as fallback.
// The 5.7 expiry sync writes user.tier='free' in the DB but never
// refreshes an open tab's session, so a session-only read would keep
// dispatching an expired user to Starter surfaces (the top-up dialog, the
// quota gate). The plan cache is already warm on every authed page (the
// header chip). Owned here once — three surfaces used to hand-roll the
// plan-then-session fallback.
export function useDispatchTier(): EntitlementTier {
  const { user } = useSession()
  const { plan } = usePlan({ user })
  return entitlementTierOf(plan?.tier ?? user?.tier)
}
